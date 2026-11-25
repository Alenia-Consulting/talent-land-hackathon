"""Gemini writes the text of each step from its clip.

It never decides where a step starts or ends (the person marked the route) and it never invents:
what the clip does not show stays empty, so the venue fills it in during the review. Whatever it
writes is a draft that a human approves before anything is published.

Only the face-blurred clip is sent, never the original recording, and the clip has no audio track.
The API is called over REST with the standard library, like storage: no extra dependency.
"""

import base64
import json
import os
import urllib.error
import urllib.request
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from db.models import MAX_POINTS, POINT_KINDS, STEP_INTERESTS

DEFAULT_MODEL = "gemini-3.8-flash"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
TIMEOUT_SECONDS = 90
# Clips go inline in the request, which Gemini caps at 20 MB.
MAX_CLIP_BYTES = 15 * 1024 * 1024
MAX_PARALLEL = 4

# Limits the contract puts on these fields (StepPatch): longer text is cut, not refused.
MAX_EASY_READ_CHARS = 300
MAX_DURATION_CHARS = 80
MAX_EXPECTATIONS = 4
MAX_EXPECTATION_CHARS = 120
MAX_LABEL_CHARS = 60
MAX_SPOKEN_CHARS = 160
# A box taller and wider than this is "the whole room", not a thing to point at; one smaller than
# MIN_BOX_AREA is a speck the visitor could not find.
MAX_BOX_AREA = 0.7
MIN_BOX_AREA = 0.002

Send = Callable[[str, dict, dict[str, str]], dict]


class GeminiError(RuntimeError):
    """Gemini was unreachable, refused the request, or answered something unusable."""


@dataclass
class StepText:
    easy_read_text: str | None = None
    what_to_expect: list[str] = field(default_factory=list)
    who_to_ask_for_help: str | None = None
    duration_text: str | None = None
    interests: list[str] = field(default_factory=list)
    points_of_interest: list[dict] = field(default_factory=list)

    def as_draft(self) -> dict:
        """The five text fields as written, to keep next to whatever a person edits afterwards."""
        return {
            "easy_read_text": self.easy_read_text,
            "what_to_expect": self.what_to_expect,
            "who_to_ask_for_help": self.who_to_ask_for_help,
            "duration_text": self.duration_text,
            "interests": self.interests,
            "points_of_interest": self.points_of_interest,
        }

    @property
    def missing_fields(self) -> list[str]:
        """The blanks the venue has to fill in. what_to_expect may be empty: nothing to warn about."""
        blanks = {
            "easy_read_text": self.easy_read_text,
            "who_to_ask_for_help": self.who_to_ask_for_help,
            "duration_text": self.duration_text,
        }
        return [name for name, value in blanks.items() if not value]


@dataclass(frozen=True)
class StepRequest:
    position: int
    title: str
    category: str
    clip: bytes
    # The face-blurred still frame the points are placed on. Empty: no points are asked for.
    photo: bytes = b""


PROMPT = """Eres quien redacta una guía de anticipación para personas autistas, sus familias y las \
personas que las acompañan. Antes de visitar un lugar real, quieren saber qué van a encontrar.

Este clip muestra una parte del recorrido que una persona ha marcado: «{title}» (categoría: \
{category}). Describe SOLO lo que se ve en el clip.

Reglas:
- Escribe en lectura fácil, en español: frases cortas, una idea por frase, segunda persona \
(«Entras por una puerta de cristal.»), sin tecnicismos. Máximo {max_chars} caracteres.
- NO inventes. Si algo no se ve en el clip, devuelve null (o una lista vacía). Es mejor dejarlo \
vacío: el establecimiento lo completará.
- No describas a las personas (ni su aspecto, ni su edad, ni lo que llevan) ni leas nombres. Habla \
del lugar: puertas, mostradores, asientos, luces, carteles, qué hay que hacer.
- what_to_expect: avisos breves sobre lo que puede resultar intenso o inesperado (hay fila, \
luz muy fuerte, espacio estrecho, mucha gente). Solo si se ve. Como mucho {max_expect}.
- who_to_ask_for_help: a quién pedir ayuda SOLO si se ve un mostrador, un cartel o un puesto \
que lo indique («Persona del mostrador azul»). Si no, null.
- duration_text: cuánto dura esta parte, en palabras fáciles («Unos 10 minutos»), solo si el \
clip da una pista razonable. Si no, null.
- interests: de esta lista, los que responde esta parte (puede ser ninguno): {interests}.
"""

POINTS_PROMPT = """Esta imagen es un fotograma de un recorrido por un lugar real, parte «{title}» \
(categoría: {category}). Sirve para orientar a personas con discapacidad cognitiva y a personas \
autistas antes de su visita: la app dibuja una flecha sobre cada punto y lee su descripción en voz alta.

Señala hasta {max_points} puntos de interés que ayuden a orientarse: salidas, puertas, ventanas, \
mesas, mostradores, baños, rampas para sillas de ruedas, lugares donde descansar o sentarse.

Reglas:
- Solo lo que se ve con claridad. NO inventes. Si no hay ninguno, devuelve una lista vacía.
- La caja va sobre el objeto o el cartel, NUNCA sobre una persona ni un rostro. Si algo está tapado \
por una persona, no lo señales.
- label: dos a cuatro palabras en español, lectura fácil («Entrada de cristal»).
- description: una o dos frases cortas que digan qué hacer, en segunda persona e imperativo \
(«Busca las puertas de cristal. Cruza por la abertura para entrar.»). Se leerá en voz alta: sin \
símbolos, sin números romanos, máximo {max_chars} caracteres.
- kind: uno de {kinds}.
- box_2d: [ymin, xmin, ymax, xmax], cada valor de 0 a 1000 sobre el alto y el ancho de la imagen.
"""

POINTS_SCHEMA = {
    "type": "OBJECT",
    "properties": {"points": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "label": {"type": "STRING"},
        "description": {"type": "STRING"},
        "kind": {"type": "STRING", "enum": list(POINT_KINDS)},
        "box_2d": {"type": "ARRAY", "items": {"type": "INTEGER"}},
    }, "required": ["label", "description", "kind", "box_2d"]}}},
    "required": ["points"],
}

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "easy_read_text": {"type": "STRING", "nullable": True},
        "what_to_expect": {"type": "ARRAY", "items": {"type": "STRING"}},
        "who_to_ask_for_help": {"type": "STRING", "nullable": True},
        "duration_text": {"type": "STRING", "nullable": True},
        "interests": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": [
        "easy_read_text", "what_to_expect", "who_to_ask_for_help", "duration_text", "interests",
    ],
}


def model_name() -> str:
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)


def api_key() -> str | None:
    return os.environ.get("GEMINI_API_KEY") or None


def _reason(error: urllib.error.HTTPError) -> str:
    """Google's own explanation (a retired model, a quota), so the log says what to fix."""
    try:
        return str(json.load(error)["error"]["message"])[:200]
    except (ValueError, KeyError, TypeError, OSError):
        return ""


def _send(url: str, body: dict, headers: dict[str, str]) -> dict:
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise GeminiError(f"gemini refused the request: HTTP {error.code} {_reason(error)}") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise GeminiError(f"gemini could not be reached: {error}") from error


def _clean(value: object, limit: int) -> str | None:
    text = " ".join(value.split()) if isinstance(value, str) else ""
    return text[:limit].rstrip() or None


def parse(raw: str) -> StepText:
    """Turn the model's JSON into a StepText, keeping only what the contract accepts."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise GeminiError("gemini did not answer JSON") from error
    if not isinstance(data, dict):
        raise GeminiError("gemini did not answer an object")

    expectations = data.get("what_to_expect")
    interests = data.get("interests")
    return StepText(
        easy_read_text=_clean(data.get("easy_read_text"), MAX_EASY_READ_CHARS),
        what_to_expect=[
            text
            for item in (expectations if isinstance(expectations, list) else [])
            if (text := _clean(item, MAX_EXPECTATION_CHARS))
        ][:MAX_EXPECTATIONS],
        who_to_ask_for_help=_clean(data.get("who_to_ask_for_help"), MAX_EASY_READ_CHARS),
        duration_text=_clean(data.get("duration_text"), MAX_DURATION_CHARS),
        interests=[
            item
            for item in dict.fromkeys(interests if isinstance(interests, list) else [])
            if item in STEP_INTERESTS
        ],
    )


def parse_points(raw: str) -> list[dict]:
    """The model's points, keeping only boxes a person could actually be shown."""
    try:
        data = json.loads(raw)
        points = data["points"]
    except (json.JSONDecodeError, KeyError, TypeError) as error:
        raise GeminiError("gemini did not answer the points as expected") from error

    kept = []
    for point in points if isinstance(points, list) else []:
        if not isinstance(point, dict):
            continue
        box = point.get("box_2d")
        label = _clean(point.get("label"), MAX_LABEL_CHARS)
        spoken = _clean(point.get("description"), MAX_SPOKEN_CHARS)
        if not (isinstance(box, list) and len(box) == 4 and label and spoken):
            continue
        if not all(isinstance(value, int | float) for value in box):
            continue
        ymin, xmin, ymax, xmax = (min(1000, max(0, round(value))) for value in box)
        area = (ymax - ymin) * (xmax - xmin) / 1_000_000
        if ymin >= ymax or xmin >= xmax or not MIN_BOX_AREA <= area <= MAX_BOX_AREA:
            continue
        kind = point.get("kind")
        kept.append({
            "label": label,
            "description": spoken,
            "kind": kind if kind in POINT_KINDS else "other",
            "box_2d": [ymin, xmin, ymax, xmax],
        })
    return kept[:MAX_POINTS]


def _generate(
    key: str, parts: list[dict], schema: dict, send: Send | None, temperature: float = 0.2
) -> str:
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }
    url = ENDPOINT.format(model=model_name())
    answer = (send or _send)(url, body, {"x-goog-api-key": key, "Content-Type": "application/json"})
    try:
        return answer["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as error:
        # No candidate: the answer was blocked or empty.
        raise GeminiError("gemini answered nothing usable") from error


def _key() -> str:
    key = api_key()
    if key is None:
        raise GeminiError("gemini is not configured: GEMINI_API_KEY is missing from api/.env")
    return key


def locate_points(request: StepRequest, *, send: Send | None = None) -> list[dict]:
    """Ask Gemini where to point on the step's photo. Static frames give far better boxes than
    a moving clip, which is why the points belong to the photo and not to the video."""
    key = _key()
    if not request.photo:
        return []
    if len(request.photo) > MAX_CLIP_BYTES:
        raise GeminiError("the photo is too big to send to gemini")
    prompt = POINTS_PROMPT.format(
        title=request.title, category=request.category, max_points=MAX_POINTS,
        max_chars=MAX_SPOKEN_CHARS, kinds=", ".join(POINT_KINDS),
    )
    parts = [
        {"inline_data": {"mime_type": "image/jpeg",
                         "data": base64.b64encode(request.photo).decode()}},
        {"text": prompt},
    ]
    return parse_points(_generate(key, parts, POINTS_SCHEMA, send, temperature=0.1))


def describe_step(request: StepRequest, *, send: Send | None = None) -> StepText:
    """Ask Gemini to write one step from its clip."""
    key = _key()
    if len(request.clip) > MAX_CLIP_BYTES:
        raise GeminiError("the clip is too big to send to gemini")

    prompt = PROMPT.format(
        title=request.title,
        category=request.category,
        max_chars=MAX_EASY_READ_CHARS,
        max_expect=MAX_EXPECTATIONS,
        interests=", ".join(STEP_INTERESTS),
    )
    parts = [
        {"inline_data": {"mime_type": "video/mp4",
                         "data": base64.b64encode(request.clip).decode()}},
        {"text": prompt},
    ]
    return parse(_generate(key, parts, SCHEMA, send))


def describe_steps(
    requests: list[StepRequest], *, send: Send | None = None
) -> dict[int, StepText | None]:
    """Write every step at once. A step that fails maps to None; the others are not affected.

    The points are a bonus on top of the text: if only they fail, the step keeps its text.
    """

    def one(request: StepRequest) -> StepText | None:
        try:
            text = describe_step(request, send=send)
        except GeminiError:
            return None
        try:
            text.points_of_interest = locate_points(request, send=send)
        except GeminiError:
            pass
        return text

    if api_key() is None or not requests:
        return {request.position: None for request in requests}
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL) as pool:
        return dict(zip((r.position for r in requests), pool.map(one, requests), strict=True))

from fastapi import FastAPI

app = FastAPI(title="talent-land-hackathon", root_path="/api")


@app.get("/health")
def health():
    return {"status": "ok"}

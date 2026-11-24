"""Errors of the media pipeline, kept apart so the modules that raise them do not import each other."""


class ProcessingUnavailable(RuntimeError):
    """The pipeline cannot run here: a tool or model it needs is missing. Answered as 503."""


class ProcessingFailed(RuntimeError):
    """This recording cannot be processed (unreadable, empty step). Answered as 422."""

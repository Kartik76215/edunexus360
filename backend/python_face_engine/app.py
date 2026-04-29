from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import math


app = FastAPI(title="ERP Python Face Engine", version="1.0.0")


class VerifyRequest(BaseModel):
    embedding: List[float] = Field(..., min_length=64, max_length=1024)
    stored_embeddings: List[List[float]] = Field(..., min_length=1)
    mean_embedding: Optional[List[float]] = Field(None, min_length=64, max_length=1024)
    threshold: float = Field(0.6, gt=0.0, lt=2.0)


class VerifyResponse(BaseModel):
    matched: bool
    match_distance: float
    match_score: float
    reference_type: Optional[str] = None
    threshold: float


def normalize(vector: List[float]) -> List[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return [0.0 for _ in vector]
    return [value / norm for value in vector]


def euclidean_distance(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return float("inf")
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/face/verify", response_model=VerifyResponse)
def face_verify(payload: VerifyRequest):
    if not payload.stored_embeddings:
        raise HTTPException(status_code=400, detail="stored_embeddings cannot be empty")

    vector_length = len(payload.embedding)
    normalized_input = normalize(payload.embedding)

    best_distance = float("inf")
    reference_type = None
    for sample in payload.stored_embeddings:
        if len(sample) != vector_length:
            raise HTTPException(status_code=400, detail="Embedding vector length mismatch")
        sample_distance = euclidean_distance(normalized_input, normalize(sample))
        if sample_distance < best_distance:
            best_distance = sample_distance
            reference_type = "sample"

    if payload.mean_embedding:
        if len(payload.mean_embedding) != vector_length:
            raise HTTPException(status_code=400, detail="Mean embedding vector length mismatch")
        mean_distance = euclidean_distance(normalized_input, normalize(payload.mean_embedding))
        if mean_distance < best_distance:
            best_distance = mean_distance
            reference_type = "mean"

    matched = best_distance <= payload.threshold
    score = max(0.0, 1.0 - best_distance)
    return VerifyResponse(
        matched=matched,
        match_distance=round(best_distance, 6),
        match_score=round(score, 4),
        reference_type=reference_type,
        threshold=payload.threshold,
    )

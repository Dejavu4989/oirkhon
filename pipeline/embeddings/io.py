"""Vector IO: npz files with `vectors` (float32 [n, d]) and `ids` (json str array)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def save(path: Path | str, vectors: np.ndarray, ids: list[str]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path,
        vectors=vectors.astype(np.float32),
        ids=np.array(json.dumps(ids, ensure_ascii=False)),
    )
    print(f"[vectors] saved {len(ids)} x {vectors.shape[1]} -> {path}")


def load(path: Path | str) -> tuple[np.ndarray, list[str]]:
    data = np.load(Path(path), allow_pickle=False)
    vectors = data["vectors"].astype(np.float32)
    ids = json.loads(str(data["ids"]))
    return vectors, ids


def l2_normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (vectors / norms).astype(np.float32)

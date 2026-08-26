"""Rule-based lemmatizer with vowel harmony, repairs and verb reconstruction."""
from __future__ import annotations

from collections.abc import Iterable, Mapping

from ..alphabet import clean_token, is_mn_word, last_harmony
from .suffixes import (
    ALL_SUFFIXES,
    CONNECTIVES_BACK,
    CONNECTIVES_FRONT,
    HARMONY_OVERRIDES,
    INSERT_VOWELS_BACK,
    INSERT_VOWELS_FRONT,
    VERBAL_GROUPS,
)


def _variant_harmony(variant: str) -> str | None:
    if variant in HARMONY_OVERRIDES:
        return HARMONY_OVERRIDES[variant]
    for ch in reversed(variant):
        if ch == "ы":
            return "back"
        if ch in "аоу":
            return "back"
        if ch in "эөү":
            return "front"
    return None


class Morphology:
    """Dictionary-first lemmatizer.

    Parameters
    ----------
    form_to_lemma : mapping of observed inflected form -> lemma (corpus-built)
    vocab         : set of known lemmas/surfaces
    freq          : optional surface -> corpus frequency, used to break ties
    """

    def __init__(
        self,
        form_to_lemma: Mapping[str, str] | None = None,
        vocab: set[str] | None = None,
        freq: Mapping[str, int] | None = None,
        max_depth: int = 3,
    ) -> None:
        self.form_to_lemma = dict(form_to_lemma or {})
        self.vocab = set(vocab) if vocab else None
        self.freq = dict(freq or {})
        self.max_depth = max_depth

    # -- knowledge helpers ---------------------------------------------------

    def known(self, w: str) -> bool:
        if self.form_to_lemma and w in self.form_to_lemma:
            return True
        if self.vocab is not None and w in self.vocab:
            return True
        return False

    def _rank_key(self, lemma: str, depth: float):
        # Prefer true vocabulary lemmas over word_forms-only surfaces (a
        # dictionary-known intermediate like морьд must not outrank the
        # deeper lemma морь), then reconstruction-boosted depth, corpus
        # frequency, length, alphabetical.
        in_vocab = 0 if (self.vocab is not None and lemma in self.vocab) else 1
        return (in_vocab, depth, -self.freq.get(lemma, 0), len(lemma), lemma)

    # -- public API ------------------------------------------------------------

    def lemmatize(self, raw: str) -> str | None:
        w = clean_token(raw)
        if not w or not is_mn_word(w) or len(w) < 2:
            return None
        if w in self.form_to_lemma:
            return self.form_to_lemma[w]
        if self.vocab is not None and w in self.vocab:
            return w  # identity wins: a valid surface word is read as itself
        candidates = self._search(w)
        if not candidates:
            return None
        return min(candidates.items(), key=lambda kv: self._rank_key(kv[0], kv[1]))[0]

    def all_candidates(self, raw: str) -> dict[str, float]:
        w = clean_token(raw)
        if not w or not is_mn_word(w):
            return {}
        cands = {w: 0.0} if (self.vocab is not None and w in self.vocab) else {}
        cands.update(self._search(w))
        return cands

    # -- bounded BFS over suffix strips ----------------------------------------

    def _harmony_ok(self, stem: str, variant: str) -> bool:
        vh = _variant_harmony(variant)
        sh = last_harmony(stem)
        if vh is None or sh is None:
            return True  # lenient: vocabulary membership is the real arbiter
        return vh == sh

    def _strips(self, node: str):
        for suf, group in ALL_SUFFIXES:
            if group == "verb_infinitive":
                # Never strip -х off infinitives: the -х form IS the citation
                # form; verbal mapping happens via reconstruction instead.
                continue
            if group == "possessive" and len(node) - len(suf) < 3:
                # Reflexive possessive on tiny stems would erase distinct
                # words (эмээ → эм); require a 3+ letter remainder.
                continue
            if not node.endswith(suf):
                continue
            stem = node[: -len(suf)]
            if len(stem) < 2 or not is_mn_word(stem):
                continue
            if not self._harmony_ok(stem, suf):
                continue
            verbal = group in VERBAL_GROUPS
            yield stem, verbal, group

    def _repairs(self, stem: str):
        """Repairs for stem alternations the bare strip cannot undo.

        өдр→өдөр (vowel restoration), тэмээг→тэмээ (epenthetic г),
        нох→нохой / мор→морь / сургуул→сургууль (stem-final glide append).
        Only returns forms known to us.
        """
        out = []
        if self.known(stem):
            return out
        if len(stem) >= 3 and stem[-1] in "гд":
            cand = stem[:-1]
            if self.known(cand):
                out.append(cand)
        h = last_harmony(stem)
        vowels = {"back": INSERT_VOWELS_BACK, "front": INSERT_VOWELS_FRONT}.get(h)
        if vowels is None:
            vowels = "аэоөиуү"
        if len(stem) >= 3:
            last = stem[-1]
            if last not in "аэиоуүёюы":
                for v in vowels:
                    cand = stem[:-1] + v + last
                    if self.known(cand):
                        out.append(cand)
        # Glide-append repairs for stems whose final consonant/vowel alternates:
        # нох+й=нохой, мор+ь=морь, сургуул+ь=сургууль, мори→мор+ь=морь.
        if len(stem) >= 2:
            if stem[-1] in "аэиоуүёюы":
                for app in ("й", "ь"):
                    cand = stem[:-1] + app
                    if self.known(cand):
                        out.append(cand)
            else:
                for app in ("й", "ь", "ой", "өй"):
                    cand = stem + app
                    if self.known(cand):
                        out.append(cand)
        return out

    def _reconstruct(self, stem: str):
        """After stripping verbal suffixes, rebuild infinitives checked against vocab.

        яв+ах=явах, унш+их=унших, хий+х=хийх, өг+өх=өгөх, ярь→яр+их=ярих …
        """
        bases = [stem]
        if stem.endswith("ь"):
            bases.append(stem[:-1])
        out = []
        for base in bases:
            h = last_harmony(base)
            conns = {"back": CONNECTIVES_BACK, "front": CONNECTIVES_FRONT}.get(h)
            if conns is None:
                conns = CONNECTIVES_BACK + CONNECTIVES_FRONT
            for c in conns:
                cand = base + c + "х"
                if len(cand) >= 2 and self.known(cand):
                    out.append(cand)
        return out

    def _search(self, word: str) -> dict[str, float]:
        best: dict[str, float] = {}

        def record(lemma: str, depth: float):
            cur = best.get(lemma)
            if cur is None or depth < cur:
                best[lemma] = depth

        frontier: list[tuple[str, int, bool]] = [(word, 0, False)]
        visited: set[str] = {word}
        while frontier:
            nxt: list[tuple[str, int, bool]] = []
            for node, depth, verbal_chain in frontier:
                for stem, verbal, _group in self._strips(node):
                    new_depth = depth + 1
                    new_chain = verbal_chain or verbal
                    if self.known(stem):
                        record(stem, float(new_depth))
                    for fixed in self._repairs(stem):
                        record(fixed, float(new_depth))
                    if new_chain:
                        for infv in self._reconstruct(stem):
                            record(infv, new_depth - 0.5)
                    if new_depth < self.max_depth and stem not in visited:
                        visited.add(stem)
                        nxt.append((stem, new_depth, new_chain))
            frontier = nxt
        return best


def build_from_vocab(vocab: Iterable[str], freq: Mapping[str, int] | None = None) -> Morphology:
    return Morphology(vocab=set(vocab), freq=freq)

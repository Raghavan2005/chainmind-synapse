from services.common.hashing import claims_root, commit_id, state_hash


def test_claims_root_sorts():
    a = "0x" + "02" * 32
    b = "0x" + "01" * 32
    assert claims_root([a, b]) == claims_root([b, a])


def test_commit_id_stable():
    subject = "0x" + "ab" * 20
    ids = ["0x" + "01" * 32, "0x" + "02" * 32]
    model = b"\x03" * 32
    assert commit_id(subject, ids, 5000, model) == commit_id(subject, list(reversed(ids)), 5000, model)


def test_commit_id_changes_with_score():
    subject = "0x" + "ab" * 20
    ids = ["0x" + "01" * 32]
    model = b"\x03" * 32
    assert commit_id(subject, ids, 1000, model) != commit_id(subject, ids, 2000, model)


def test_state_hash_changes_with_score():
    subject = "0x" + "ab" * 20
    ids = ["0x" + "01" * 32]
    model = b"\x03" * 32
    assert state_hash(subject, ids, 1000, model, 1) != state_hash(subject, ids, 2000, model, 1)

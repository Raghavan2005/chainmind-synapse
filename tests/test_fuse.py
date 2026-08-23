from services.fuse.opinions import Opinion, average, cumulative, expect, to_opinion


def test_to_opinion_roundtrip():
    omega = to_opinion(2, 2, a=0.5, w=2)
    assert abs((omega.b + omega.d + omega.u) - 1.0) < 1e-12
    assert abs(expect(omega) - (omega.b + omega.a * omega.u)) < 1e-12


def test_cumulative_worked_example():
    a = Opinion(0.70, 0.10, 0.20, 0.50)
    b = Opinion(0.10, 0.70, 0.20, 0.50)
    fused = cumulative(a, b)
    assert abs(fused.b - 0.16 / 0.36) < 1e-9
    assert abs(fused.d - 0.16 / 0.36) < 1e-9
    assert abs(fused.u - 0.04 / 0.36) < 1e-9
    assert abs(expect(fused) - 0.5) < 1e-9


def test_zero_uncertainty_disagreement_uses_average():
    a = Opinion(1.0, 0.0, 0.0, 0.5)
    b = Opinion(0.0, 1.0, 0.0, 0.5)
    fused = cumulative(a, b)
    avg = average(a, b)
    assert abs(fused.b - avg.b) < 1e-9
    assert abs(fused.d - avg.d) < 1e-9


def test_average_formula():
    a = Opinion(0.70, 0.10, 0.20, 0.50)
    b = Opinion(0.10, 0.70, 0.20, 0.50)
    fused = average(a, b)
    assert abs(fused.b - (0.70 * 0.20 + 0.10 * 0.20) / 0.40) < 1e-9
    assert abs(fused.u - (2 * 0.20 * 0.20) / 0.40) < 1e-9

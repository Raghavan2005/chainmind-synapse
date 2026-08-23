from __future__ import annotations

from dataclasses import dataclass

W = 2.0
A0 = 0.5


@dataclass(frozen=True)
class Opinion:
    b: float
    d: float
    u: float
    a: float

    def p(self) -> float:
        return self.b + self.a * self.u

    def as_dict(self) -> dict[str, float]:
        return {"b": self.b, "d": self.d, "u": self.u, "a": self.a, "p": self.p()}


def to_opinion(r: float, s: float, a: float = A0, w: float = W) -> Opinion:
    den = r + s + w
    return Opinion(b=r / den, d=s / den, u=w / den, a=a)


def expect(omega: Opinion) -> float:
    return omega.p()


def from_sklearn(p_i: float, mass: float, polarity: int, revoked: bool, expired: bool) -> Opinion:
    p = min(max(p_i, 0.0), 1.0)
    m = min(max(mass, 0.5), 8.0)
    if revoked or expired:
        p = min(p, 0.05)
        s_extra = 2.0
    else:
        s_extra = 0.0
    r = m * p
    s = m * (1.0 - p) + s_extra
    omega = to_opinion(r, s)
    if polarity == -1:
        omega = Opinion(b=omega.d, d=omega.b, u=omega.u, a=omega.a)
    return omega


def cumulative(a: Opinion, b: Opinion) -> Opinion:
    den = a.u + b.u - a.u * b.u
    if a.u == 0.0 and b.u == 0.0:
        if abs(a.b - b.b) < 1e-12 and abs(a.d - b.d) < 1e-12:
            return a
        return average(a, b)
    if abs(den) < 1e-15:
        return average(a, b)
    bb = (a.b * b.u + b.b * a.u) / den
    dd = (a.d * b.u + b.d * a.u) / den
    uu = (a.u * b.u) / den
    aa_den = a.u + b.u - 2.0 * a.u * b.u
    aa = (a.a * b.u + b.a * a.u - (a.a + b.a) * a.u * b.u) / aa_den if abs(aa_den) > 1e-15 else a.a
    return Opinion(b=bb, d=dd, u=uu, a=aa)


def average(a: Opinion, b: Opinion) -> Opinion:
    den = a.u + b.u
    if abs(den) < 1e-15:
        return Opinion(b=(a.b + b.b) / 2.0, d=(a.d + b.d) / 2.0, u=0.0, a=(a.a + b.a) / 2.0)
    return Opinion(
        b=(a.b * b.u + b.b * a.u) / den,
        d=(a.d * b.u + b.d * a.u) / den,
        u=(2.0 * a.u * b.u) / den,
        a=(a.a + b.a) / 2.0,
    )


def discount(trust_b: float, omega: Opinion) -> Opinion:
    return Opinion(b=trust_b * omega.b, d=trust_b * omega.d, u=(1.0 - trust_b) + trust_b * omega.u, a=omega.a)


def pairwise_k(a: Opinion, b: Opinion) -> float:
    return a.b * b.d + a.d * b.b

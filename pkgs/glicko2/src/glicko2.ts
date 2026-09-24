/**
 * Glicko-2 rating system (Mark Glickman, "Example of the Glicko-2 system").
 *
 * One call = one rating period holding zero or more results. Everything is
 * pure: no clock, no RNG, no storage. Callers persist {@link Glicko2Rating}
 * and decide how to round it.
 *
 * Determinism: the update is float math (`exp` / `log` / `sqrt`), so callers
 * that persist or compare ratings must round first — see the repo's
 * determinism notes on float state.
 */

/** Rating the system assigns to a player with no history. */
export const GLICKO2_DEFAULT_RATING = 1500;
/** Rating deviation of a player with no history (maximum uncertainty). */
export const GLICKO2_DEFAULT_RD = 350;
/** Volatility of a player with no history. */
export const GLICKO2_DEFAULT_VOLATILITY = 0.06;
/**
 * System constant τ: how fast volatility may move. Glickman suggests
 * 0.3–1.2; smaller means steadier ratings.
 */
export const GLICKO2_DEFAULT_TAU = 0.5;
/** Convergence tolerance of the volatility root-finder. */
export const GLICKO2_DEFAULT_EPSILON = 0.000001;
/** Glicko-1 → Glicko-2 scale factor (400 / ln 10). */
export const GLICKO2_SCALE = 173.7178;

/** Guard so the root-finder always terminates on adversarial inputs. */
const MAX_BRACKET_STEPS = 100;
const MAX_ILLINOIS_STEPS = 100;

export type Glicko2Rating = {
  readonly rating: number;
  readonly rd: number;
  readonly volatility: number;
};

/** Score of one game: 1 = win, 0.5 = draw, 0 = loss. */
export type Glicko2Score = number;

export type Glicko2Result = {
  readonly opponentRating: number;
  readonly opponentRd: number;
  readonly score: Glicko2Score;
};

export type Glicko2Options = {
  readonly tau?: number;
  readonly epsilon?: number;
  /** Clamp on the returned RD (a player never becomes more uncertain). */
  readonly maxRd?: number;
  /** Floor on the returned RD (a player is never perfectly known). */
  readonly minRd?: number;
};

export const GLICKO2_DEFAULT: Glicko2Rating = {
  rating: GLICKO2_DEFAULT_RATING,
  rd: GLICKO2_DEFAULT_RD,
  volatility: GLICKO2_DEFAULT_VOLATILITY,
};

type Scaled = { readonly mu: number; readonly phi: number };

function toScaled(rating: Glicko2Rating): Scaled {
  return {
    mu: (rating.rating - GLICKO2_DEFAULT_RATING) / GLICKO2_SCALE,
    phi: rating.rd / GLICKO2_SCALE,
  };
}

/** g(φ): how much an opponent's own uncertainty damps the update. */
function gOf(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** E(μ, μj, φj): expected score against one opponent. */
function expectedScore(mu: number, opponent: Scaled): number {
  return 1 / (1 + Math.exp(-gOf(opponent.phi) * (mu - opponent.mu)));
}

/**
 * Expected score of `player` against `opponent` on the Glicko-1 scale — the
 * probability the system assigns to a win before the game is played.
 */
export function glicko2ExpectedScore(
  player: Glicko2Rating,
  opponent: Glicko2Rating
): number {
  return expectedScore(toScaled(player).mu, toScaled(opponent));
}

type Accumulated = {
  /** v: estimated variance of the rating based only on game outcomes. */
  readonly v: number;
  /** Σ g(φj)(sj − E): the outcome-weighted direction of the update. */
  readonly sum: number;
};

function accumulate(
  mu: number,
  results: readonly Glicko2Result[]
): Accumulated {
  let inverseV = 0;
  let sum = 0;
  for (const result of results) {
    // Only the opponent's rating and RD enter the update; their volatility
    // is their own business.
    const opponent: Scaled = {
      mu: (result.opponentRating - GLICKO2_DEFAULT_RATING) / GLICKO2_SCALE,
      phi: result.opponentRd / GLICKO2_SCALE,
    };
    const g = gOf(opponent.phi);
    const e = expectedScore(mu, opponent);
    inverseV += g * g * e * (1 - e);
    sum += g * (result.score - e);
  }
  return { v: 1 / inverseV, sum };
}

type VolatilityArgs = {
  readonly phi: number;
  readonly v: number;
  readonly delta: number;
  readonly volatility: number;
  readonly tau: number;
  readonly epsilon: number;
};

/** f(x) from step 5.1 of the paper. */
function volatilityF(args: VolatilityArgs, x: number): number {
  const { phi, v, delta, volatility, tau } = args;
  const ex = Math.exp(x);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;
  const denominator = 2 * (phiSq + v + ex) * (phiSq + v + ex);
  const a = Math.log(volatility * volatility);
  return (
    (ex * (deltaSq - phiSq - v - ex)) / denominator - (x - a) / (tau * tau)
  );
}

/** Lower end of the bracket: walk down by τ until f turns negative. */
function lowerBound(args: VolatilityArgs, a: number): number {
  let k = 1;
  while (volatilityF(args, a - k * args.tau) < 0 && k < MAX_BRACKET_STEPS) {
    k += 1;
  }
  return a - k * args.tau;
}

/** Step 5: new volatility σ′ via the Illinois variant of regula falsi. */
function solveVolatility(args: VolatilityArgs): number {
  const a = Math.log(args.volatility * args.volatility);
  const deltaSq = args.delta * args.delta;
  const phiSq = args.phi * args.phi;
  let lo = a;
  let hi =
    deltaSq > phiSq + args.v
      ? Math.log(deltaSq - phiSq - args.v)
      : lowerBound(args, a);
  let fLo = volatilityF(args, lo);
  let fHi = volatilityF(args, hi);
  let steps = 0;
  while (Math.abs(hi - lo) > args.epsilon && steps < MAX_ILLINOIS_STEPS) {
    const mid = lo + ((lo - hi) * fLo) / (fHi - fLo);
    const fMid = volatilityF(args, mid);
    if (fMid * fHi <= 0) {
      lo = hi;
      fLo = fHi;
    } else {
      fLo /= 2;
    }
    hi = mid;
    fHi = fMid;
    steps += 1;
  }
  return Math.exp(hi / 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A rating period with no games: the player's rating stands and their RD
 * grows by their volatility (they become less certain through inactivity).
 */
export function glicko2Decay(
  player: Glicko2Rating,
  options?: Glicko2Options
): Glicko2Rating {
  const { phi } = toScaled(player);
  const phiStar = Math.sqrt(phi * phi + player.volatility * player.volatility);
  return {
    rating: player.rating,
    rd: clamp(
      phiStar * GLICKO2_SCALE,
      options?.minRd ?? 0,
      options?.maxRd ?? GLICKO2_DEFAULT_RD
    ),
    volatility: player.volatility,
  };
}

/**
 * The player's rating after one rating period containing `results`.
 *
 * With no results this is {@link glicko2Decay}. With one result it is the
 * "one game per period" mode every puzzle trainer uses: each attempt is a
 * game against the puzzle.
 */
export function glicko2Update(
  player: Glicko2Rating,
  results: readonly Glicko2Result[],
  options?: Glicko2Options
): Glicko2Rating {
  if (results.length === 0) return glicko2Decay(player, options);
  const tau = options?.tau ?? GLICKO2_DEFAULT_TAU;
  const epsilon = options?.epsilon ?? GLICKO2_DEFAULT_EPSILON;
  const { mu, phi } = toScaled(player);
  const { v, sum } = accumulate(mu, results);
  const delta = v * sum;
  const volatility = solveVolatility({
    phi,
    v,
    delta,
    volatility: player.volatility,
    tau,
    epsilon,
  });
  const phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * sum;
  return {
    rating: muPrime * GLICKO2_SCALE + GLICKO2_DEFAULT_RATING,
    rd: clamp(
      phiPrime * GLICKO2_SCALE,
      options?.minRd ?? 0,
      options?.maxRd ?? GLICKO2_DEFAULT_RD
    ),
    volatility,
  };
}

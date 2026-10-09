import { DEG, TAU, trueAnomaly } from "./math";

export const AU = 149_597_870.7;
export const MU_SUN = 1.32712440018e11;
const DAY = 86400;

const A_E = 1;
const A_M = 1.5237;
const A_T = (A_E + A_M) / 2;
const E_T = (A_M - A_E) / (A_M + A_E);
export const TRANSFER_TIME = Math.PI * Math.sqrt((A_T * AU) ** 3 / MU_SUN);

const N_E = TAU / (365.256 * DAY);
const N_M = TAU / (686.98 * DAY);
/** Earth longitude at TMI, rotated so the mini-map reads left-to-right. */
const LAMBDA_E0 = 200 * DEG;
const LAMBDA_M0 = LAMBDA_E0 + Math.PI - N_M * TRANSFER_TIME;

export interface HelioState {
  earth: [number, number];
  mars: [number, number];
  ship: [number, number];
  /** Ship heliocentric speed, km/s. */
  shipSpeed: number;
  earthDist: number;
  marsDist: number;
}

const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];

/** tau: seconds since TMI. Positions in AU on the ecliptic plane. */
export function helioState(tau: number): HelioState {
  const earth = polar(A_E, LAMBDA_E0 + N_E * tau);
  const mars = polar(A_M, LAMBDA_M0 + N_M * tau);
  let ship: [number, number];
  let shipSpeed: number;
  if (tau <= 0) {
    ship = earth;
    shipSpeed = 29.78;
  } else if (tau >= TRANSFER_TIME) {
    ship = mars;
    shipSpeed = 24.07;
  } else {
    const nu = trueAnomaly((Math.PI * tau) / TRANSFER_TIME, E_T);
    const r = (A_T * (1 - E_T * E_T)) / (1 + E_T * Math.cos(nu));
    ship = polar(r, LAMBDA_E0 + nu);
    shipSpeed = Math.sqrt(MU_SUN * (2 / (r * AU) - 1 / (A_T * AU)));
  }
  const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) * AU;
  return { earth, mars, ship, shipSpeed, earthDist: d(ship, earth), marsDist: d(ship, mars) };
}

export const HELIO = { A_E, A_M, A_T, E_T, LAMBDA_E0, LAMBDA_M0 };

export function transferEllipsePoint(nu: number): [number, number] {
  const r = (A_T * (1 - E_T * E_T)) / (1 + E_T * Math.cos(nu));
  return polar(r, LAMBDA_E0 + nu);
}

import type { DriverRatings } from "../../src/data/types";

/**
 * Prior ratings per driver (0..100), keyed by Jolpica driverId.
 *
 * - `pace` is only a prior: the script keeps each team's average of these priors, then splits it
 *   between the two teammates using their real 2026 qualifying gap.
 * - The other attributes are used as written.
 *
 * Edit here and rerun `npm run data`; never edit src/data/drivers.json by hand.
 */
export const curatedDrivers: Record<string, DriverRatings> = {
  max_verstappen: {
    pace: 97,
    racecraft: 97,
    tyreManagement: 92,
    wetSkill: 97,
    consistency: 93,
  },
  hadjar: {
    pace: 86,
    racecraft: 82,
    tyreManagement: 78,
    wetSkill: 79,
    consistency: 82,
  },
  norris: {
    pace: 93,
    racecraft: 87,
    tyreManagement: 87,
    wetSkill: 86,
    consistency: 87,
  },
  piastri: {
    pace: 92,
    racecraft: 89,
    tyreManagement: 89,
    wetSkill: 82,
    consistency: 88,
  },
  leclerc: {
    pace: 94,
    racecraft: 89,
    tyreManagement: 84,
    wetSkill: 84,
    consistency: 85,
  },
  hamilton: {
    pace: 91,
    racecraft: 93,
    tyreManagement: 93,
    wetSkill: 96,
    consistency: 90,
  },
  russell: {
    pace: 93,
    racecraft: 87,
    tyreManagement: 88,
    wetSkill: 88,
    consistency: 89,
  },
  antonelli: {
    pace: 91,
    racecraft: 85,
    tyreManagement: 81,
    wetSkill: 84,
    consistency: 82,
  },
  alonso: {
    pace: 89,
    racecraft: 95,
    tyreManagement: 92,
    wetSkill: 93,
    consistency: 92,
  },
  stroll: {
    pace: 79,
    racecraft: 79,
    tyreManagement: 77,
    wetSkill: 82,
    consistency: 76,
  },
  gasly: {
    pace: 86,
    racecraft: 85,
    tyreManagement: 82,
    wetSkill: 85,
    consistency: 86,
  },
  colapinto: {
    pace: 80,
    racecraft: 79,
    tyreManagement: 73,
    wetSkill: 73,
    consistency: 74,
  },
  albon: {
    pace: 86,
    racecraft: 85,
    tyreManagement: 86,
    wetSkill: 82,
    consistency: 85,
  },
  sainz: {
    pace: 88,
    racecraft: 88,
    tyreManagement: 88,
    wetSkill: 85,
    consistency: 88,
  },
  lawson: {
    pace: 82,
    racecraft: 83,
    tyreManagement: 78,
    wetSkill: 78,
    consistency: 78,
  },
  arvid_lindblad: {
    pace: 81,
    racecraft: 78,
    tyreManagement: 72,
    wetSkill: 74,
    consistency: 76,
  },
  hulkenberg: {
    pace: 85,
    racecraft: 85,
    tyreManagement: 84,
    wetSkill: 85,
    consistency: 88,
  },
  bortoleto: {
    pace: 83,
    racecraft: 80,
    tyreManagement: 77,
    wetSkill: 77,
    consistency: 80,
  },
  ocon: {
    pace: 83,
    racecraft: 85,
    tyreManagement: 85,
    wetSkill: 86,
    consistency: 84,
  },
  bearman: {
    pace: 84,
    racecraft: 82,
    tyreManagement: 78,
    wetSkill: 78,
    consistency: 79,
  },
  perez: {
    pace: 82,
    racecraft: 85,
    tyreManagement: 92,
    wetSkill: 82,
    consistency: 79,
  },
  bottas: {
    pace: 83,
    racecraft: 80,
    tyreManagement: 85,
    wetSkill: 80,
    consistency: 87,
  },
};

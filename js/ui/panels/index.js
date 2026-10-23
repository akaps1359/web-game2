import { focusPanel } from './focus.js';
import { politicsPanel } from './politics.js';
import { researchPanel } from './research.js';
import { industryPanel } from './industry.js';
import { militaryPanel } from './military.js';
import { diplomacyPanel, countryPanel } from './diplomacy.js';
import { statePanel, seaPanel, fleetPanel } from './state.js';
import { unitsPanel } from './units.js';
import { menuPanel, newsPanel, helpPanel, musicPanel } from './menu.js';

export const PANELS = {
  focus: focusPanel, politics: politicsPanel, research: researchPanel, industry: industryPanel,
  military: militaryPanel, diplomacy: diplomacyPanel, country: countryPanel,
  state: statePanel, sea: seaPanel, fleet: fleetPanel, units: unitsPanel,
  menu: menuPanel, news: newsPanel, help: helpPanel, music: musicPanel,
};

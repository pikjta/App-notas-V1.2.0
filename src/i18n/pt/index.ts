import type { Dict } from '../es/index';
import { app } from './app';
import { settings } from './settings';
import { agenda } from './agenda';
import { pm } from './pm';
import { calc } from './calc';
import { cards } from './cards';
import { sample } from './sample';

export const pt: Dict = { ...app, ...settings, ...agenda, ...pm, ...calc, ...cards, ...sample };

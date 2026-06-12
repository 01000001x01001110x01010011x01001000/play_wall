import type { GameModule } from "../types";
import { tictactoe } from "./tictactoe";
import { zerosones } from "./zerosones";
import { snake } from "./snake";
import { minichess } from "./minichess";

export const games: GameModule[] = [tictactoe, zerosones, snake, minichess];

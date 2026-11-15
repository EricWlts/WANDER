/** The studio entrance animation plays once after each successful sign-in (Studio.tsx arms it),
 *  not on every visit to the studio. Kept in memory only. */
let armed = false;
export const studioIntroPlayed = () => !armed;
export const markStudioIntroPlayed = () => { armed = false; };
export const armStudioIntro = () => { armed = true; };

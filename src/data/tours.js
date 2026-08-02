/**
 * The narrated tours.
 *
 * This copy is written to be *spoken*, which makes it a different text from
 * anything printed on the board: short clauses, no parentheses, no
 * abbreviations a synthesiser will mangle, numbers written the way a person
 * says them out loud.
 *
 * Performance marks:
 *   ||   a beat
 *   |||  a longer beat, before a reveal
 *   ~…~  slow this clause down
 *
 * Each beat can move the camera, scrub the year, change mode, or switch on a
 * lens — the tour drives the whole instrument, not just the voice.
 */

const b = (o) => ({ hold: 500, ...o })

/** The opening: said over the field of case cards. */
export const ARCHIVE_TOUR = [
  b({
    say: "You're in an archive. ||| Every card drifting past you is a case somebody never closed. || Most of them, nobody will ever open again.",
    hold: 700,
  }),
  b({
    say: 'Six of them have files here. || Real ones. || Photographs, letters, police reports, ~things that were never explained~.',
  }),
  b({
    say: "Here's how this works. || Your scroll wheel doesn't zoom. || It walks you across the room. || The closer you get to a piece of paper, the more of it is actually there.",
    hold: 800,
  }),
  b({
    say: "Lean into a newspaper and you'll read the headline. || Keep going and you'll read the article. || Keep going after that || and you'll find what somebody wrote in the margin.",
    hold: 800,
  }),
  b({
    say: "So. ||| Pick one. || Click any card and I'll take you inside. || Or close this panel and go in alone.",
    hold: 1400,
    prompt: true,
  }),
]

// ═══════════════════════════════════════════════════════════════════════════

const zodiac = [
  b({
    move: 'wide',
    year: 2024,
    say: 'This is the Zodiac board. ||| Five murders, in Northern California, over about ten months. || And then a man who would not stop writing to the newspapers about it.',
    hold: 900,
  }),
  b({
    focus: 'z-phonecall',
    year: 1969,
    say: "Start here, || because this is where two separate cases became one. || Forty minutes after a shooting at Blue Rock Springs, a man telephoned the police and claimed it. || Then he claimed a double murder from the previous December that nobody had connected to it.",
  }),
  b({
    focus: 'z-phonecall',
    say: "The operator said something strange about him. ||| She said he sounded like he was ~reading~, || not speaking. ||| He had written it out first.",
    hold: 900,
  }),
  b({
    focus: 'z-letter1',
    say: 'Six weeks later, three Bay Area newspapers each got a letter. || The same opening line, || and one third of a cipher in each envelope. || He wanted it on the front page, and he threatened a weekend of killing if it was not.',
  }),
  b({
    focus: 'z-408',
    say: 'That cipher lasted a week. ||| A schoolteacher and his wife in Salinas broke it, by guessing that a man like this would begin with the word "I". ||| They were right. || And the message had no name in it.',
    hold: 700,
  }),
  b({
    focus: 'z-stine',
    say: 'October the twelfth. || A taxi driver shot at Washington and Cherry, inside the city. || Witnesses across the street watched the man tear a piece out of the driver\'s shirt and walk away north.',
  }),
  b({
    focus: 'z-stine',
    say: 'A patrol car passed him on foot, minutes later. ||| The description that had gone out over the radio said the suspect was a Black male. || So the officer did not stop the white man he saw walking. ||| That is the largest what-if in this entire file.',
    hold: 1000,
  }),
  b({
    focus: 'z-shirt',
    lens: 'uv',
    say: 'The next day, the Chronicle received a piece of that shirt. || Which is how we know the letters are genuine. ||| Look at the paper now — || I have switched the room lights off and put an ultraviolet lamp on it. || Move your cursor across the page.',
    hold: 2600,
  }),
  b({
    lens: 'none',
    focus: 'z-340',
    say: 'And then this one. ||| Three hundred and forty characters, mailed in November. ||| Every serious code-breaker of the twentieth century failed against it.',
  }),
  b({
    focus: 'z-340',
    say: 'It fell in December two thousand and twenty. || Fifty-one years. || Three people, on three continents, working out that he had scrambled the message ~diagonally~ before he substituted the symbols. ||| The answer was a shape, not a word. ||| And still no name.',
    hold: 1000,
  }),
  b({
    focus: 'z-allen',
    say: "There is a famous suspect. || He has been named in books and documentaries for fifty years. ||| The handwriting analysis excluded him in nineteen seventy-one. || The partial DNA did not match. || He was never charged. ||| Famous is not the same as likely.",
    hold: 800,
  }),
  b({
    mode: 'graph',
    say: 'Let me lift it all off the board. ||| Now you can see the shape of the case instead of the paperwork. || Drag to turn it. ||| Yellow threads are the same handwriting. || Red is physical evidence. || The thin dark ones are the connections nobody has ever proved.',
    hold: 2400,
  }),
  b({
    mode: 'board',
    year: 1969,
    say: "One last thing. || I've put the board back to nineteen sixty-nine. ||| This is everything the police actually had at the time. || Everything else on that board arrived later. ||| Drag the year slider yourself and watch the case assemble.",
    hold: 1600,
  }),
]

const cooper = [
  b({
    move: 'wide',
    year: 2024,
    say: "D. B. Cooper. ||| The only unsolved skyjacking in American history. ||| And the name is wrong. || A wire service misheard 'Dan' as 'D. B.', and the mistake outlived the fact.",
    hold: 900,
  }),
  b({
    focus: 'c-note',
    say: 'He bought a one-way ticket with cash, sat down, ordered a bourbon and soda, || and handed a flight attendant a note saying he had a bomb in his briefcase. ||| Then he took the note back. ||| He knew about handwriting.',
  }),
  b({
    focus: 'c-money',
    say: 'He asked for two hundred thousand dollars in twenty-dollar bills, and four parachutes. ||| The bank photographed every serial number before handing the money over. ||| In more than fifty years, not one of those bills has ever been spent and detected.',
    hold: 700,
  }),
  b({
    focus: 'c-727',
    say: 'He asked for a specific aircraft. || A Boeing seven twenty-seven, the only airliner with a staircase under its tail you could open in flight. ||| And he specified the flap setting. ||| That is not a lucky guess.',
  }),
  b({
    focus: 'c-chutes',
    say: 'But here is the problem with that. ||| One of the four parachutes they gave him was a training rig. || Sewn shut. || Completely unusable. ||| He took it anyway. ||| Either he could not tell, or it did not matter to him. Neither answer is comfortable.',
    hold: 900,
  }),
  b({
    focus: 'c-weather',
    say: 'He jumped at about eight in the evening, into freezing rain, in darkness, over unlit forest. ||| In a business suit. ||| And loafers.',
    hold: 800,
  }),
  b({
    focus: 'c-search',
    say: 'They searched for eighteen months. || Soldiers walking in line abreast. || Divers in the lake. ||| They even flew the same route again and pushed a dummy out of the same door to see where it landed. ||| Nothing.',
  }),
  b({
    focus: 'c-tena',
    year: 1980,
    say: "Then, in nineteen eighty, || an eight-year-old boy clearing a fire pit on a sandbar of the Columbia River found five thousand eight hundred dollars in rotting twenties. ||| Serial numbers matched.",
    hold: 700,
  }),
  b({
    focus: 'c-tena',
    say: 'And this is the detail that has kept people awake ever since. ||| The rubber bands were still on. || The bills were still in bank order. ||| That money did not blow there loose. || It arrived as a bundle.',
    hold: 900,
  }),
  b({
    focus: 'c-tie',
    year: 2024,
    lens: 'ir',
    say: "He left one thing behind. || A cheap clip-on tie, on seat eighteen E. ||| Decades later, an electron microscope found particles on it including pure, unalloyed titanium — rare in nineteen seventy-one. ||| I've put an infrared lamp on it. || Sweep your cursor over the fabric.",
    hold: 2600,
  }),
  b({
    lens: 'none',
    focus: 'c-suspects',
    say: 'Eight hundred and eighty-six suspects. || Forty-five years. || Deathbed confessions. ||| Every single identification runs into the same wall. || No bills. || No equipment. || No body.',
  }),
  b({
    focus: 'c-vane',
    say: "In nineteen seventy-two, Boeing fitted a little paddle to the tail of every seven twenty-seven ever built, so nobody could ever do it again. ||| It is called the Cooper vane. ||| A safety device on thousands of aircraft, || named after a man nobody can name.",
    hold: 1200,
  }),
]

const mh370 = [
  b({
    move: 'wide',
    year: 2024,
    say: 'Malaysia Airlines flight three seven zero. ||| Two hundred and thirty-nine people. ||| A Boeing triple seven does not simply stop existing. ||| This one did.',
    hold: 900,
  }),
  b({
    focus: 'm-goodnight',
    year: 2014,
    say: 'The last thing anyone heard was completely ordinary. ||| "Good night. Malaysian three seven zero." ||| No stress in the voice. || Nothing unusual at all.',
  }),
  b({
    focus: 'm-goodnight',
    say: 'Two minutes later the transponder stopped. ||| And look at ~where~ that happened. || Exactly at the handover between Malaysian and Vietnamese air traffic control. ||| The one point on the route where, for a few minutes, nobody is really watching.',
    hold: 900,
  }),
  b({
    focus: 'm-turn',
    say: 'Military radar then tracked an unidentified aircraft turning around, || crossing back over the peninsula, || and flying up the Strait of Malacca. ||| It was navigating between waypoints. ||| Somebody was flying it.',
  }),
  b({
    focus: 'm-handshake',
    say: "And then it left radar coverage. ||| Which should have been the end of the story. ||| Except that a satellite terminal on board kept quietly answering an hourly status poll || for six more hours.",
    hold: 800,
  }),
  b({
    focus: 'm-handshake',
    say: 'Those polls were never meant to locate anything. || They are essentially a billing handshake. ||| But the timing gives you a distance from the satellite, and the frequency error gives you a Doppler signature. ||| People located a missing airliner using the logs of a billing system. || That is extraordinary.',
    hold: 900,
  }),
  b({
    focus: 'm-arc',
    say: 'It gives you this. ||| Not a point. || An arc. || Thousands of kilometres of empty southern Indian Ocean. ||| And the choice between north and south rests entirely on the sign of a frequency offset.',
  }),
  b({
    focus: 'm-flaperon',
    year: 2015,
    say: 'Seventeen months later, a flaperon washed up on a beach on Réunion, four thousand kilometres away. ||| Serial number confirmed. ||| That single part ended every theory that the aircraft landed somewhere.',
    hold: 700,
  }),
  b({
    focus: 'm-flaperon',
    say: 'And it carried something else. ||| Goose barnacles. || Each one grows in rings, and the rings record water temperature. ||| A drift path, written in calcite, by animals.',
    hold: 900,
  }),
  b({
    focus: 'm-search1',
    year: 2017,
    say: 'They searched a hundred and twenty thousand square kilometres of seabed that had never been mapped at any resolution, at depths beyond six thousand metres. ||| They found two nineteenth-century shipwrecks. ||| They did not find the aircraft.',
  }),
  b({
    focus: 'm-report',
    year: 2018,
    say: 'The official report runs to four hundred and ninety-five pages. ||| Its conclusion is that the turn was flown by hand, || and that they cannot determine who was flying it or why. ||| Four words. || "Unable to determine."',
    hold: 900,
  }),
  b({
    mode: 'graph',
    year: 2024,
    say: 'Look at the shape of it. ||| Every hypothesis on this board explains most of the evidence and then breaks on the rest. ||| A depressurisation explains six silent hours || and cannot explain the first forty minutes. ||| That is why this one is still open.',
    hold: 2400,
  }),
]

const titanic = [
  b({
    move: 'wide',
    year: 2024,
    say: "Titanic is not a mystery about what happened. ||| We know what happened. ||| It is a mystery about why so many separate things went wrong on the same night, || and why two official inquiries looked at the same witnesses and disagreed.",
    hold: 900,
  }),
  b({
    focus: 't-warnings',
    year: 1912,
    say: 'At least six ships sent ice warnings that day. ||| The radio operators were commercial staff, paid to send passenger telegrams. ||| Navigation warnings were competing with holiday messages for their attention.',
  }),
  b({
    focus: 't-warnings',
    lens: 'uv',
    say: "And one of those warnings — the most precisely relevant of all of them — appears to have never reached the bridge at all. ||| I've put an ultraviolet lamp on it. || Move your cursor across the paper.",
    hold: 2600,
  }),
  b({
    lens: 'none',
    focus: 't-speed',
    say: "They kept going at around twenty-two knots. ||| Which sounds indefensible, and was completely standard. ||| The accepted method was to post lookouts and trust that you would see ice in time. ||| The British inquiry declined to call it negligent, because ~everybody~ did it.",
    hold: 800,
  }),
  b({
    focus: 't-lookout',
    say: 'The lookouts had no binoculars. || The key to the locker had left the ship at Southampton with a reassigned officer. ||| But that is not really the reason.',
  }),
  b({
    focus: 't-lookout',
    say: 'The sea was dead flat. ||| No swell. ||| And without swell breaking white at its base, an iceberg at night gives you almost nothing to see. ||| The calm is the culprit.',
    hold: 900,
  }),
  b({
    focus: 't-boats',
    say: 'There were lifeboats for one thousand one hundred and seventy-eight people, on a ship carrying two thousand two hundred and twenty-four. ||| And she carried ~more~ boats than the law required. ||| The regulations were indexed to tonnage, and had not been revised since eighteen ninety-four.',
  }),
  b({
    focus: 't-boats',
    say: 'The first boat away carried twenty-eight people. ||| It was built for sixty-five. ||| There had been no boat drill. || Most passengers did not know where to go, and a great many of them did not believe the ship could sink.',
    hold: 900,
  }),
  b({
    focus: 't-californian',
    say: 'Now the part people still argue about. ||| A ship was stopped in the ice a few miles away. || Her officers watched a nearby vessel fire eight white rockets. ||| And they did not wake their radio operator.',
    hold: 1000,
  }),
  b({
    focus: 't-carpathia',
    say: 'Compare that with Carpathia. ||| Rostron turned his ship, shut off the heating to make more steam, posted extra lookouts, and drove through the same ice field faster than his ship was designed to go. ||| Same night. || Same ocean. || Two completely different decisions.',
    hold: 900,
  }),
  b({
    focus: 't-position',
    say: 'The distress position they transmitted was wrong by about thirteen nautical miles. ||| Men doing arithmetic while the deck tilted underneath them. ||| That error sent every search in the wrong direction for seventy years.',
  }),
  b({
    focus: 't-wreck',
    year: 1985,
    say: 'Nineteen eighty-five. || Found at three thousand eight hundred metres. ||| And she was in two pieces, six hundred metres apart. ||| Survivors had said she broke on the surface. || In nineteen twelve they were discounted, because officers said otherwise. ||| The passengers were right.',
    hold: 1000,
  }),
  b({
    focus: 't-reforms',
    year: 2024,
    say: 'This is the only board in the archive with an answer at the end of it. ||| Lifeboats for every person aboard. || A radio watch around the clock. || An international ice patrol. ||| Those rules still govern every ship at sea. ||| It cost fifteen hundred lives to write them down.',
    hold: 1400,
  }),
]

const dyatlov = [
  b({
    move: 'wide',
    year: 2024,
    say: 'Nine experienced ski-hikers, in the northern Urals, in February nineteen fifty-nine. ||| The mountain is called Kholat Syakhl. ||| In the local Mansi language, that means Dead Mountain. ||| It meant that before any of this happened.',
    hold: 900,
  }),
  b({
    focus: 'd-tent',
    year: 1959,
    say: 'Everything in this case follows from one physical fact. ||| The tent was cut open ~from the inside~. ||| Three slashes. || One hand. ||| That single finding rules out every version of the story where somebody else opened it.',
    hold: 1000,
  }),
  b({
    focus: 'd-tent',
    say: 'Their boots were still inside. || Their axes. || Their food. || Their outer clothing. ||| They cut their way out of a warm tent and left all of it behind.',
  }),
  b({
    focus: 'd-footprints',
    say: "Now, this is the part I find hardest. ||| The tracks going down the slope are evenly spaced. ||| Nobody ran. || Nobody scattered. ||| Nine people made an orderly decision to walk a mile and a half downhill, in the dark, at twenty-five below, ~in their socks~.",
    hold: 1100,
  }),
  b({
    focus: 'd-cedar',
    say: 'They reached the treeline and built a small fire under a cedar. ||| Branches were snapped off that tree as high as five metres up. ||| Which means somebody climbed it in the dark. || Looking back toward the tent, probably.',
  }),
  b({
    focus: 'd-ravine',
    say: 'Four of them were not found until May, under four metres of snow, in a stream bed. ||| They were wearing clothing taken from the ones who had already died. ||| So they lasted longer. || They were still trying.',
    hold: 900,
  }),
  b({
    focus: 'd-autopsy',
    say: 'And their injuries make no sense at first hearing. ||| Crushed chests. || A fractured skull. ||| Force comparable to a car crash. ||| And the skin over the top of it completely unbroken.',
    hold: 900,
  }),
  b({
    focus: 'd-verdict',
    say: 'The nineteen fifty-nine investigation closed the case with the phrase "a compelling natural force". ||| That is not a finding. || It is a shrug. ||| The region was closed to travellers for three years afterwards.',
  }),
  b({
    focus: 'd-radiation',
    lens: 'ir',
    say: 'There was also a small amount of beta contamination on parts of three garments. ||| Not on the bodies. || Only on clothing. ||| It is the weakest evidence in this file, and it is the piece that ate the entire case. ||| Sweep the infrared lamp across it.',
    hold: 2600,
  }),
  b({
    lens: 'none',
    focus: 'd-slope',
    say: 'So why camp high, on an open slope, with no shelter? ||| Because dropping down to the trees means losing altitude you have to climb again in the morning. ||| It was a deliberate decision by an experienced leader. ||| And it cut a shelf into the snow.',
  }),
  b({
    focus: 'd-slab',
    year: 2021,
    say: 'Two thousand and twenty-one. ||| Two engineers modelled it properly. ||| Cutting a shelf into a lee slope of that angle, in that snowpack, can release a small slab ~hours later~. ||| Long after the digging that caused it.',
    hold: 800,
  }),
  b({
    focus: 'd-slab',
    say: 'And the simulated loading reproduces those exact injuries. || Broad force. || Unbroken skin. ||| It explains the tent, the timing, the injuries, and the barefoot walk downhill. ||| It does not explain the radiation readings. ||| And it does not claim to. || Which is what makes it good science.',
    hold: 1400,
  }),
]

const ripper = [
  b({
    move: 'wide',
    year: 2024,
    say: 'Autumn, eighteen eighty-eight, in the East End of London. ||| This is the first crime in history that the whole country followed in the newspapers, ~daily~, while it was still happening. ||| That fact is not background. || It is part of the case.',
    hold: 900,
  }),
  b({
    focus: 'r-map',
    year: 1888,
    say: 'Everything happened inside about a quarter of a mile. ||| You could walk between all five sites in fifteen minutes. ||| Seventy-eight thousand people lived in those courts and alleys, most of it unlit.',
  }),
  b({
    focus: 'r-chapman',
    say: 'The second killing was in a back yard, reached through a passage used by seventeen residents, at an hour when the street was already waking up. ||| Enclosed. || Overlooked on three sides. || Minutes from daylight. ||| He knew exactly how long he had.',
    hold: 800,
  }),
  b({
    focus: 'r-dearboss',
    say: 'Then a letter arrived at a news agency, signed with a name nobody had used before. ||| "Yours truly, Jack the Ripper." ||| That letter is where the name comes from.',
  }),
  b({
    focus: 'r-dearboss',
    lens: 'uv',
    say: 'And senior police officers at the time believed a journalist wrote it, to keep the story running. ||| The most famous name in criminal history is probably a piece of marketing. ||| Put the ultraviolet lamp on it and see what the agency stamped on the back.',
    hold: 2600,
  }),
  b({
    lens: 'none',
    focus: 'r-double',
    say: 'The thirtieth of September. || Two killings, forty-five minutes apart. ||| And the second one happened half a mile west — inside the City of London police district, not the Metropolitan one. ||| From that night, two separate forces investigated one offender, and did not share everything.',
    hold: 900,
  }),
  b({
    focus: 'r-goulston',
    say: 'That same night, a piece of a victim\'s apron was found in a doorway. || And chalked on the doorframe above it was a sentence about "the Jews". ||| The Commissioner ordered it washed off before it could be photographed.',
  }),
  b({
    focus: 'r-goulston',
    say: 'He was trying to prevent a riot at daybreak, in a district that was already close to one. ||| Defensible. ||| And a catastrophe for the file. ||| Officers who saw it recorded at least three different wordings. ||| The most-discussed sentence in this case survives only as contradictory memory.',
    hold: 1000,
  }),
  b({
    focus: 'r-forensics',
    say: "Here is the thing people forget. ||| Fingerprint identification did not arrive at the Metropolitan Police until nineteen oh one. || Neither did a reliable test for human blood. ||| Only the last scene was ever photographed. ||| The tools showed up thirteen years too late.",
    hold: 900,
  }),
  b({
    focus: 'r-macnaghten',
    year: 1894,
    say: 'Almost every suspect theory you have ever heard descends from one private memorandum, written in eighteen ninety-four, ||| by a senior officer who joined the force ~after~ the murders, || from memory, || in two versions that disagree with each other, || containing errors you can demonstrate.',
    hold: 1000,
  }),
  b({
    focus: 'r-victims',
    year: 2024,
    say: 'One correction, and it matters. ||| For a century the five were described almost entirely by how they earned money. ||| Recent work reconstructed them as people. || With trades, families, addresses. ||| Several of them were most likely asleep when they were killed.',
    hold: 1000,
  }),
  b({
    focus: 'r-files',
    say: 'And this is why it will not be solved. ||| Large parts of the police files were stolen by souvenir hunters over the following century. || Others were destroyed in routine weeding, or in the Blitz. ||| What survives is not the investigation. ||| It is what was left after a hundred years of attrition.',
    hold: 1400,
  }),
]

export const TOURS = { zodiac, cooper, mh370, titanic, dyatlov, ripper }

/** Which exhibit a free explorer should be nudged toward first. */
export const OPENING_MOVE = {
  zodiac: { id: 'z-letter1', line: 'Start with the letter he sent to three newspapers at once.' },
  cooper: { id: 'c-note', line: 'Start with the note he handed over — and then took back.' },
  mh370: { id: 'm-handshake', line: 'Start with the seven satellite handshakes. They are the whole case.' },
  titanic: { id: 't-californian', line: 'Start with the ship that watched the rockets and did nothing.' },
  dyatlov: { id: 'd-tent', line: 'Start with the tent. It was cut open from the inside.' },
  ripper: { id: 'r-goulston', line: 'Start with the sentence that was washed off the wall before dawn.' },
}

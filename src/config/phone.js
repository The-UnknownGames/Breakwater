// Phone, radio and voice (V8, ROADMAP_V7). Contacts, feed voices, bank,
// market and radio station settings.

// People in your phone. `voice` picks a speech voice (lang, pitch, rate)
// and is used on the VHF too; `radio` names the radio prefix they speak
// under.
export const CONTACTS = [
  { id: 'maggie', name: 'Maggie Rourke', role: 'Harbormaster, Kettle Harbor', radio: ['Kettle Harbor'], voice: { lang: 'en-GB', pitch: 0.95, rate: 1.0, female: true } },
  { id: 'coastguard', name: 'Reach Coastguard', role: 'Search and rescue coordination', radio: ['MAYDAY', 'Coastguard'], voice: { lang: 'en-GB', pitch: 0.8, rate: 0.98 } },
  { id: 'weather', name: 'Coastal Weather', role: 'Marine forecast, the Reach', radio: ['Kettle Harbor weather'], voice: { lang: 'en-IE', pitch: 1.05, rate: 0.95 } },
  { id: 'yard', name: 'Kettle Shipyard', role: 'Repairs, boats, upgrades', radio: [], voice: { lang: 'en-GB', pitch: 0.9, rate: 1.02 } },
  { id: 'fleet', name: 'Fleet office', role: 'Your hired crews', radio: ['Fleet office'], voice: { lang: 'en-US', pitch: 1.0, rate: 1.05 } },
  { id: 'bank', name: 'Reach Bank', role: 'Accounts and loans', radio: [], voice: { lang: 'en-GB', pitch: 1.0, rate: 1.0 } },
  { id: 'ewan', name: 'Old Ewan', role: 'Regular at the Kettle & Anchor', radio: [], voice: { lang: 'en-GB', pitch: 0.7, rate: 0.9 } },
];

// "Harbour Life": handles who post about what happens on the water.
export const FEED = {
  handles: [
    { id: 'kettle_watch', name: 'Kettle Harbour Watch' },
    { id: 'reach_spotter', name: 'Reach Ship Spotter' },
    { id: 'pellow_pete', name: 'Pete at Pellow' },
    { id: 'gull_cam', name: 'Breakwater Gull Cam' },
    { id: 'annie_nets', name: 'Annie (Ellen Mary)' },
    { id: 'coast_photos', name: 'Grey Reach Photography' },
  ],
  maxPosts: 60,
  maxPhotos: 12,
};

export const BANK = {
  // Loan limit grows with reputation.
  loanBase: 5000,
  loanPerRep: 400,
  interestPerDay: 0.03, // per game day, accrued hourly
  steps: [2000, 5000, 10000, 20000],
};

export const MARKET = {
  // Used boats: condition 0.55..0.95, engine hours 600..9000; price from the
  // new price by condition and hours. One to three listings a game day.
  used: { condition: [0.55, 0.95], hours: [600, 9000], perDay: [1, 3], keepDays: 2 },
  // Fish prices move by port and day (x0.75..1.3 of the ground price).
  fish: { min: 0.75, max: 1.3 },
  parts: [
    { id: 'flares', label: 'Parachute flares ×6', price: 110 },
    { id: 'patch', label: 'Hull patch kit (+20% hull, to 90%)', price: 450 },
  ],
};

// Wheelhouse radio (B cycles). Music stations are procedural unless files
// are listed in public/audio/stations/manifest.json.
export const RADIO_SET = {
  stations: [
    { id: 'off', name: 'Off' },
    { id: 'vhf16', name: 'VHF 16' },
    { id: 'weather', name: 'Coastal Weather' },
    { id: 'folk', name: 'Reach Folk' },
    { id: 'ambient', name: 'Low Tide FM' },
  ],
  musicLevel: 0.22,
  deckCutoff: 900, // Hz: heard through the wheelhouse walls from the deck
  helmCutoff: 16000,
  earshot: 35, // m from the boat before the set can't be heard ashore
  weatherEveryGameHours: 1,
};

// Voice over the radio (Web Speech, subtitled always).
export const VOICE = {
  maxQueue: 3,
  staticLevel: 0.05, // radio hiss under a spoken call
  squelchLevel: 0.12,
};

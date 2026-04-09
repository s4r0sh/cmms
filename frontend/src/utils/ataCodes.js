// src/utils/ataCodes.js
export const ataCodes = [
  { code: "21", name: "Air Conditioning" },
  { code: "24", name: "Electrical Power" },
  { code: "27", name: "Flight Controls" },
  { code: "28", name: "Fuel" },
  { code: "32", name: "Landing Gear" },
  { code: "34", name: "Navigation" },
  { code: "36", name: "Pneumatics" },
  { code: "49", name: "APU" },
  { code: "71", name: "Powerplant" },
  { code: "78", name: "Exhaust" },
  { code: "80", name: "Starting" },
];

export const ataName = (code) => {
  const found = ataCodes.find((a) => a.code === code);
  return found ? found.name : code;
};

import type { ProductDetails } from "./types";

export const INGCO_LAUNCH_PRODUCTS: ProductDetails[] = [
{
title: "20V CORDLESS 3-IN-1 COMBO KIT",
model: "CKLI20358",
barcode: "6942141824272",
description: "Brushless grinder, impact drill and impact wrench kit with batteries, charger and carry case.",
specs: ["BRUSHLESS 3-TOOL COMBO", "66NM IMPACT DRILL", "405NM IMPACT WRENCH", "2x 20V 4.0AH BATTERIES"],
prices: { list: 4699.48, nett: 2819.69, fivePlusOne: 2349.74, tenPlusThree: 2168.99 },
imageCrop: { x: 0, y: 0.27, width: 0.61, height: 0.5 },
},
{
title: "20V CORDLESS 3D LASER LEVEL KIT",
model: "HLL3012165",
barcode: "6942141822261",
description: "Three-plane laser level kit with magnetic stand, rotary base, remote, batteries and case.",
specs: ["3x 360 DEG LASER LINES", "+/-1.5MM @ 7M ACCURACY", "0-35M WORKING RANGE", "2x 20V 2.0AH BATTERIES"],
prices: { list: 4351.78, nett: 2611.07, fivePlusOne: 2175.89, tenPlusThree: 2008.52 },
imageCrop: { x: 0, y: 0.275, width: 0.665, height: 0.495 },
},
{
title: "20V CORDLESS 96NM IMPACT DRILL KIT",
model: "CIDLI209689",
barcode: "8887915006127",
description: "Heavy-duty brushless impact drill kit with accessories, two batteries, charger and carry case.",
specs: ["96NM MAX TORQUE", "0-2,100 RPM", "BRUSHLESS MOTOR", "2x 20V 4.0AH BATTERIES"],
prices: { list: 4042.67, nett: 2425.6, fivePlusOne: 2021.33, tenPlusThree: 1865.85 },
imageCrop: { x: 0.035, y: 0.285, width: 0.61, height: 0.49 },
},
{
title: "20V CORDLESS ROTARY HAMMER",
model: "CRHLI26208",
barcode: "6942141824166",
description: "Four-function brushless SDS Plus rotary hammer with drill bits and chisel included.",
specs: ["2.5J IMPACT ENERGY", "SDS PLUS CHUCK", "26MM CONCRETE CAPACITY", "BATTERY & CHARGER EXCLUDED"],
prices: { list: 2249.65, nett: 1349.79, fivePlusOne: 1124.83, tenPlusThree: 1038.3 },
imageCrop: { x: 0.015, y: 0.275, width: 0.61, height: 0.5 },
},
{
title: "CORDED SPRAY GUN",
model: "SPG4506",
barcode: "6942141815249",
description: "Adjustable electric spray gun supplied with cleaning tools and viscosity measuring cup.",
specs: ["530W INPUT POWER", "1,000ML CONTAINER", "410ML/MIN PAINT FLOW", "ADJUSTABLE SPRAY PATTERN"],
prices: { list: 819.58, nett: 491.75, fivePlusOne: 409.79, tenPlusThree: 378.27 },
imageCrop: { x: 0.005, y: 0.285, width: 0.62, height: 0.46 },
},
{
title: "16-INCH TOOL BAG",
model: "HTBG12",
barcode: "8887915008503",
description: "Hard-wearing 1680D polyester tool bag with reinforced base and adjustable shoulder strap.",
specs: ["16-INCH / 44x30x30CM", "20KG MAX LOAD", "25 STORAGE POCKETS", "REINFORCED PLASTIC BASE"],
prices: { list: 697.02, nett: 418.21, fivePlusOne: 348.51, tenPlusThree: 321.7 },
imageCrop: { x: 0, y: 0.27, width: 0.63, height: 0.505 },
},
{
title: "19-INCH STACKABLE TOOL TOTE",
model: "PBXS104",
barcode: "6942141820533",
description: "Large stackable polypropylene tool tote for workshop storage and transport.",
specs: ["475x320x270MM", "41.5L CAPACITY", "20KG MAX LOAD", "STACKABLE PP CONSTRUCTION"],
prices: { list: 517.92, nett: 310.75, fivePlusOne: 258.96, tenPlusThree: 239.04 },
imageCrop: { x: 0.02, y: 0.275, width: 0.61, height: 0.46 },
},
];

const normalise = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function findCatalogProduct(text: string, pageIndex?: number, filename = "") {
const clean = normalise(text);
const direct = INGCO_LAUNCH_PRODUCTS.find(
(product) => clean.includes(normalise(product.model)) || clean.includes(product.barcode),
);
if (direct) return direct;
if (/INGCO NEW PRODUCT LAUNCH/i.test(filename) && pageIndex !== undefined) {
return INGCO_LAUNCH_PRODUCTS[pageIndex];
}
}


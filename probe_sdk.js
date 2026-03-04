import * as genai from '@google/genai';
import * as genaiNode from '@google/genai/node';

console.log("--- @google/genai exports ---");
console.log(Object.keys(genai));

console.log("\n--- @google/genai/node exports ---");
console.log(Object.keys(genaiNode));

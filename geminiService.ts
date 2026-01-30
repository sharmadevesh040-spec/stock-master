
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Transaction } from "./types";

// Initialize GoogleGenAI with a named parameter for the API key using process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getInventoryInsights = async (products: Product[], transactions: Transaction[]) => {
  // Query the model directly using generateContent with model name and content.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this inventory data and provide 3 key insights or recommendations for the business owner. 
    Note: All currency values are in Indian Rupees (₹).
    Products: ${JSON.stringify(products.map(p => ({ name: p.name, stock: p.stock, min: p.minStockLevel })))}
    Recent Transactions: ${JSON.stringify(transactions.slice(-10))}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, description: 'Low, Medium, High' }
              },
              required: ['title', 'description', 'priority']
            }
          }
        },
        required: ['insights']
      }
    }
  });

  // Extract text output from GenerateContentResponse using the .text property.
  const jsonStr = response.text || '{}';
  return JSON.parse(jsonStr);
};

export const generateSalesSummary = async (transactions: Transaction[], products: Product[]) => {
  // Use ai.models.generateContent to query the model with both parameters in a single call.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on these sales transactions: ${JSON.stringify(transactions)}, write a short, professional executive summary of sales performance in Indian Rupees (₹). Mention top selling categories and any potential stock-out risks.`,
  });

  // The .text property returns the extracted string output.
  return response.text;
};

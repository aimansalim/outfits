// AI Outfit Generator with Structured Output
class AIOutfitGenerator {
  constructor() {
    this.apiKey = window.OPENAI_API_KEY || 'YOUR_API_KEY_HERE';
    this.model = 'gpt-4o-2024-08-06';
  }

  async initialize() {
    // Check if OpenAI is available
    if (typeof window === 'undefined') {
      throw new Error('AI Outfit Generator requires a browser environment');
    }
    console.log('AI Outfit Generator initialized');
  }

  async generateOutfit(prompt, manifest) {
    if (!manifest || !manifest.items) {
      throw new Error('No clothing items available');
    }

    // Create structured schema for outfit recommendation
    const outfitSchema = {
      type: "object",
      properties: {
        reasoning: {
          type: "string",
          description: "Brief explanation of why this outfit was chosen"
        },
        style: {
          type: "string",
          description: "The style category (e.g., casual, formal, streetwear, minimal, etc.)"
        },
        colors: {
          type: "array",
          items: { type: "string" },
          description: "Main colors in the outfit"
        },
        top_base: {
          type: "string",
          description: "ID of the base top item to wear"
        },
        top_overshirt: {
          type: "string",
          description: "ID of the overshirt item (can be null if not needed)"
        },
        outerwear: {
          type: "string",
          description: "ID of the jacket/outerwear item (can be null if not needed)"
        },
        bottom: {
          type: "string", 
          description: "ID of the bottom item to wear"
        },
        shoes: {
          type: "string",
          description: "ID of the shoes to wear"
        }
      },
      required: ["reasoning", "style", "colors", "top_base", "bottom", "shoes"],
      additionalProperties: false
    };

    // Prepare available items for AI
    const availableItems = this.prepareItemsForAI(manifest);
    
    const systemPrompt = `You are a fashion AI that creates perfect outfits from a user's wardrobe. 
    
Available items:
${JSON.stringify(availableItems, null, 2)}

Rules:
- Choose items that work well together
- Consider color harmony and style consistency
- Match the user's request (e.g., "cozy fit" = comfortable, warm items)
- Only use item IDs that exist in the available items
- You can leave top_overshirt and outerwear as null if not needed
- Consider the season and occasion

Respond with a JSON object matching the schema.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Create an outfit for: "${prompt}"` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "outfit_recommendation",
              schema: outfitSchema,
              strict: true
            }
          },
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        return JSON.parse(content);
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error(`Failed to generate outfit: ${error.message}`);
    }
  }

  prepareItemsForAI(manifest) {
    const items = {};
    
    // Categorize items for AI
    manifest.items.forEach(item => {
      const category = item.category || 'unknown';
      if (!items[category]) items[category] = [];
      
      items[category].push({
        id: item.id,
        name: item.name || 'Unnamed item',
        colors: item.colors || [],
        styles: item.styles || [],
        description: item.description || ''
      });
    });

    return items;
  }

  async applyOutfitRecommendation(recommendation, manifest) {
    // Find the actual items from manifest
    const findItem = (id) => {
      return manifest.items.find(item => item.id === id);
    };

    const outfit = {
      top_base: findItem(recommendation.top_base),
      top_overshirt: recommendation.top_overshirt ? findItem(recommendation.top_overshirt) : null,
      outerwear: recommendation.outerwear ? findItem(recommendation.outerwear) : null,
      bottom: findItem(recommendation.bottom),
      shoes: findItem(recommendation.shoes),
      images: {}
    };

    // Load images for the outfit
    if (outfit.top_base) outfit.images.top_base = outfit.top_base.file;
    if (outfit.top_overshirt) outfit.images.top_overshirt = outfit.top_overshirt.file;
    if (outfit.outerwear) outfit.images.outerwear = outfit.outerwear.file;
    if (outfit.bottom) outfit.images.bottom = outfit.bottom.file;
    if (outfit.shoes) outfit.images.shoes = outfit.shoes.file;

    return outfit;
  }
}
// AI Outfit Generator with Structured Outputs
// Uses OpenAI API with structured JSON schema for outfit recommendations

class AIOutfitGenerator {
  constructor() {
    this.apiKey = null;
    this.isGenerating = false;
  }

  async initialize() {
    // Try to get API key from environment or prompt user
    this.apiKey = localStorage.getItem('openai_api_key');
    if (!this.apiKey) {
      this.apiKey = prompt('Enter your OpenAI API key:');
      if (this.apiKey) {
        localStorage.setItem('openai_api_key', this.apiKey);
      } else {
        throw new Error('OpenAI API key required');
      }
    }
  }

  // JSON Schema for outfit recommendations
  getOutfitSchema() {
    return {
      type: "object",
      properties: {
        reasoning: {
          type: "string",
          description: "Brief explanation of why this outfit works for the request"
        },
        style: {
          type: "string",
          enum: ["casual", "formal", "street", "sport"],
          description: "Overall style of the recommended outfit"
        },
        outfit: {
          type: "object",
          properties: {
            top_base: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" }
              },
              required: ["id", "name", "reason"],
              additionalProperties: false
            },
            top_overshirt: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" }
              },
              required: ["id", "name", "reason"],
              additionalProperties: false
            },
            outerwear: {
              type: ["object", "null"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" }
              },
              required: ["id", "name", "reason"],
              additionalProperties: false
            },
            bottom: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" }
              },
              required: ["id", "name", "reason"],
              additionalProperties: false
            },
            shoes: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" }
              },
              required: ["id", "name", "reason"],
              additionalProperties: false
            }
          },
          required: ["top_base", "top_overshirt", "bottom", "shoes"],
          additionalProperties: false
        }
      },
      required: ["reasoning", "style", "outfit"],
      additionalProperties: false
    };
  }

  async generateOutfit(prompt, availableItems) {
    if (this.isGenerating) {
      throw new Error('Already generating an outfit');
    }

    this.isGenerating = true;

    try {
      // Prepare the items data for the AI
      const itemsData = this.prepareItemsData(availableItems);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o-2024-08-06",
          messages: [
            {
              role: "system",
              content: `You are an expert fashion stylist. Given a user's request and their available clothing items, recommend the best outfit combination.

Rules:
1. Always select exactly one item from each required category (top_base, top_overshirt, bottom, shoes)
2. Only select outerwear if it makes sense for the request
3. Consider color coordination, style matching, and appropriateness for the occasion
4. Explain your reasoning for each choice
5. Ensure the outfit is cohesive and matches the user's request

Available items: ${JSON.stringify(itemsData, null, 2)}`
            },
            {
              role: "user",
              content: `I want: ${prompt}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "outfit_recommendation",
              schema: this.getOutfitSchema(),
              strict: true
            }
          },
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const recommendation = JSON.parse(data.choices[0].message.content);
      
      return recommendation;
    } finally {
      this.isGenerating = false;
    }
  }

  prepareItemsData(items) {
    const categorized = {
      top_base: [],
      top_overshirt: [],
      outerwear: [],
      bottom: [],
      shoes: []
    };

    items.forEach(item => {
      const itemData = {
        id: item.id,
        name: item.name,
        category: item.category,
        topLayer: item.topLayer,
        colors: item.colorHints || [],
        styles: item.styleHints || [],
        file: item.file
      };

      if (item.category === 'top' && item.topLayer === 'base') {
        categorized.top_base.push(itemData);
      } else if (item.category === 'top' && item.topLayer === 'overshirt') {
        categorized.top_overshirt.push(itemData);
      } else if (item.category === 'jacket' || item.category === 'outerwear') {
        categorized.outerwear.push(itemData);
      } else if (item.category === 'bottom' || item.category === 'pants') {
        categorized.bottom.push(itemData);
      } else if (item.category === 'shoes') {
        categorized.shoes.push(itemData);
      }
    });

    return categorized;
  }

  findItemById(items, id) {
    return items.find(item => item.id === id);
  }

  async applyOutfitRecommendation(recommendation, allItems) {
    const outfit = {
      top_base: this.findItemById(allItems, recommendation.outfit.top_base.id),
      top_overshirt: this.findItemById(allItems, recommendation.outfit.top_overshirt.id),
      outerwear: recommendation.outfit.outerwear ? this.findItemById(allItems, recommendation.outfit.outerwear.id) : null,
      bottom: this.findItemById(allItems, recommendation.outfit.bottom.id),
      shoes: this.findItemById(allItems, recommendation.outfit.shoes.id)
    };

    // Load images for the selected items
    const images = await this.loadOutfitImages(outfit);
    outfit.images = images;

    return outfit;
  }

  async loadOutfitImages(outfit) {
    const loadImage = async (src) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
      });
    };

    const images = {};
    
    if (outfit.top_base) {
      images.top_base = await loadImage(outfit.top_base.file);
    }
    if (outfit.top_overshirt) {
      images.top_overshirt = await loadImage(outfit.top_overshirt.file);
    }
    if (outfit.outerwear) {
      images.outerwear = await loadImage(outfit.outerwear.file);
    }
    if (outfit.bottom) {
      images.bottom = await loadImage(outfit.bottom.file);
    }
    if (outfit.shoes) {
      images.shoes = await loadImage(outfit.shoes.file);
    }

    return images;
  }
}

// Export for use in main.js
window.AIOutfitGenerator = AIOutfitGenerator;

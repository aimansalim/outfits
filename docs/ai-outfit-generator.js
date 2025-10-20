// AI Outfit Generator with Structured Output
class AIOutfitGenerator {
  constructor() {
    this.apiKey = window.CONFIG?.OPENAI_API_KEY || 'YOUR_API_KEY_HERE';
    this.model = window.CONFIG?.OPENAI_MODEL || 'gpt-4o-2024-08-06';
  }

  async initialize() {
    // Check if OpenAI is available
    if (typeof window === 'undefined') {
      throw new Error('AI Outfit Generator requires a browser environment');
    }
    console.log('AI Outfit Generator initialized');
  }

  getHardcodedItems() {
    return [
      // TOPS
      { id: 'white-polo-tee', name: 'White Polo Tee', category: 'top_base', colors: ['white'], styles: ['casual', 'minimal'], file: 'assets/tees/white-polo-tee.png' },
      { id: 'green-polo-tee', name: 'Green Polo Tee', category: 'top_base', colors: ['green'], styles: ['casual', 'sporty'], file: 'assets/tees/green-polo-tee.png' },
      { id: 'black-polo-tee', name: 'Black Polo Tee', category: 'top_base', colors: ['black'], styles: ['casual', 'minimal'], file: 'assets/tees/black-polo-tee-red-horse.png' },
      { id: 'white-moncler-tee', name: 'White Moncler Tee', category: 'top_base', colors: ['white'], styles: ['luxury', 'minimal'], file: 'assets/tees/white-moncler-tee.png' },
      { id: 'white-wide-tee', name: 'White Wide Tee', category: 'top_base', colors: ['white'], styles: ['streetwear', 'oversized'], file: 'assets/tees/white-wide-tee.png' },
      
      // OVERSHIRTS
      { id: 'beige-polo-crewneck', name: 'Beige Polo Crewneck', category: 'top_overshirt', colors: ['beige'], styles: ['casual', 'preppy'], file: 'assets/midlayer/beige-polo-crewneck.png' },
      { id: 'black-half-button', name: 'Black Half Button', category: 'top_overshirt', colors: ['black'], styles: ['minimal', 'casual'], file: 'assets/midlayer/black-half-button-long-sleeve.png' },
      { id: 'green-linen-button', name: 'Green Linen Button', category: 'top_overshirt', colors: ['green'], styles: ['casual', 'summer'], file: 'assets/midlayer/green-linen-button-up.png' },
      { id: 'military-green-armani', name: 'Military Green Armani', category: 'top_overshirt', colors: ['green'], styles: ['luxury', 'military'], file: 'assets/midlayer/military-green-armani-button-up.png' },
      
      // JACKETS
      { id: 'black-montone', name: 'Black Montone', category: 'outerwear', colors: ['black'], styles: ['luxury', 'minimal'], file: 'assets/jackets/black-montone.png' },
      { id: 'black-parka', name: 'Black Parka', category: 'outerwear', colors: ['black'], styles: ['streetwear', 'winter'], file: 'assets/jackets/black-parka-waterproof.png' },
      { id: 'technical-waterproof', name: 'Technical Waterproof', category: 'outerwear', colors: ['black'], styles: ['technical', 'outdoor'], file: 'assets/technical-waterproof-black-parka.png' },
      
      // BOTTOMS
      { id: 'black-cotton-pants', name: 'Black Cotton Pants', category: 'bottom', colors: ['black'], styles: ['minimal', 'casual'], file: 'assets/pants/black-cotton-pants.png' },
      { id: 'black-linen-pants', name: 'Black Linen Pants', category: 'bottom', colors: ['black'], styles: ['minimal', 'summer'], file: 'assets/pants/black-linen-pants.png' },
      { id: 'black-nike-soft', name: 'Black Nike Soft', category: 'bottom', colors: ['black'], styles: ['sporty', 'casual'], file: 'assets/pants/black-nike-soft-pants.png' },
      { id: 'green-linen-pants', name: 'Green Linen Pants', category: 'bottom', colors: ['green'], styles: ['casual', 'summer'], file: 'assets/pants/green-linen-pants.png' },
      { id: 'grey-linen-pants', name: 'Grey Linen Pants', category: 'bottom', colors: ['grey'], styles: ['minimal', 'summer'], file: 'assets/pants/grey-linen-pants.png' },
      { id: 'navy-linen-pants', name: 'Navy Linen Pants', category: 'bottom', colors: ['navy'], styles: ['minimal', 'summer'], file: 'assets/pants/navy-linen-pants.png' },
      
      // SHOES
      { id: 'adidas-samba-white-bordeaux', name: 'Adidas Samba White Bordeaux', category: 'shoes', colors: ['white', 'bordeaux'], styles: ['sporty', 'retro'], file: 'assets/shoes/adidas-samba-white-bordeaux.png' },
      { id: 'adidas-samba-white-green', name: 'Adidas Samba White Green', category: 'shoes', colors: ['white', 'green'], styles: ['sporty', 'retro'], file: 'assets/shoes/adidas-samba-white-green.png' },
      { id: 'black-chelsea-boots', name: 'Black Chelsea Boots', category: 'shoes', colors: ['black'], styles: ['minimal', 'formal'], file: 'assets/shoes/black-chelsea-boots.png' },
      { id: 'brown-chelsea-boots', name: 'Brown Chelsea Boots', category: 'shoes', colors: ['brown'], styles: ['minimal', 'casual'], file: 'assets/shoes/brown-chelsea-boots.png' },
      { id: 'golden-goose-bianche', name: 'Golden Goose Bianche', category: 'shoes', colors: ['white'], styles: ['luxury', 'streetwear'], file: 'assets/shoes/golden-goose-bianche-verdi.png' },
      { id: 'golden-goose-nere', name: 'Golden Goose Nere', category: 'shoes', colors: ['black'], styles: ['luxury', 'streetwear'], file: 'assets/shoes/golden-goose-nere.png' },
      { id: 'mocassino-beige', name: 'Mocassino Beige', category: 'shoes', colors: ['beige'], styles: ['formal', 'minimal'], file: 'assets/shoes/mocassino-beige.png' },
      { id: 'new-balance-military', name: 'New Balance Military', category: 'shoes', colors: ['green'], styles: ['sporty', 'military'], file: 'assets/shoes/new-balance-large-sole-military-green.png' },
      { id: 'new-balance-white', name: 'New Balance White', category: 'shoes', colors: ['white'], styles: ['sporty', 'minimal'], file: 'assets/shoes/new-balance-white.png' },
      { id: 'salomon-xt-4', name: 'Salomon XT-4', category: 'shoes', colors: ['black'], styles: ['technical', 'outdoor'], file: 'assets/shoes/salomon-xt-4-og.png' }
    ];
  }

  async generateOutfit(prompt, manifest) {
    // Use ONLY uploaded items from wardrobe
    const uploadedItems = manifest?.items || [];
    
    console.log('Using ONLY uploaded items:', uploadedItems.length, 'items');
    console.log('Uploaded items:', uploadedItems.slice(0, 3).map(item => ({ id: item.id, name: item.name, category: item.category })));
    
    if (!uploadedItems || uploadedItems.length === 0) {
      throw new Error('No clothing items available. Please upload some clothes first.');
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
    const availableItems = this.prepareItemsForAI({ items: uploadedItems });
    
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
      console.log('Falling back to local AI simulation...');
      
      // Fallback: Generate outfit locally based on prompt
      return this.generateLocalOutfit(prompt, uploadedItems);
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

  generateLocalOutfit(prompt, items) {
    console.log('Generating local outfit for:', prompt);
    
    // Simple local AI based on prompt keywords
    const promptLower = prompt.toLowerCase();
    
    // Categorize items based on actual uploaded data structure
    const tops = items.filter(item => 
      (item.category === 'top' && item.topLayer === 'base') || 
      item.category === 'top_base'
    );
    const overshirts = items.filter(item => 
      (item.category === 'top' && item.topLayer === 'overshirt') || 
      item.category === 'top_overshirt'
    );
    const jackets = items.filter(item => item.category === 'outerwear');
    const bottoms = items.filter(item => item.category === 'bottom');
    const shoes = items.filter(item => item.category === 'shoes');
    
    console.log('Categorized items:', { tops: tops.length, overshirts: overshirts.length, jackets: jackets.length, bottoms: bottoms.length, shoes: shoes.length });
    
    // Style-based selection
    let selectedTop = null;
    let selectedOvershirt = null;
    let selectedJacket = null;
    let selectedBottom = null;
    let selectedShoes = null;
    let style = 'casual';
    let colors = [];
    let reasoning = '';
    
    // Select based on prompt
    if (promptLower.includes('streetwear') || promptLower.includes('street')) {
      style = 'streetwear';
      selectedTop = tops.find(t => t.name.toLowerCase().includes('wide') || t.styles?.includes('streetwear')) || tops[0];
      selectedBottom = bottoms.find(b => b.name.toLowerCase().includes('nike') || b.styles?.includes('sporty')) || bottoms[0];
      selectedShoes = shoes.find(s => s.name.toLowerCase().includes('samba') || s.styles?.includes('sporty')) || shoes[0];
      reasoning = 'Streetwear look with oversized top and sporty elements';
    } else if (promptLower.includes('old money') || promptLower.includes('luxury') || promptLower.includes('preppy')) {
      style = 'luxury';
      selectedTop = tops.find(t => t.name.toLowerCase().includes('moncler') || t.styles?.includes('luxury')) || tops[0];
      selectedBottom = bottoms.find(b => b.name.toLowerCase().includes('linen') || b.styles?.includes('minimal')) || bottoms[0];
      selectedShoes = shoes.find(s => s.name.toLowerCase().includes('chelsea') || s.styles?.includes('formal')) || shoes[0];
      reasoning = 'Old money aesthetic with luxury brands and clean lines';
    } else if (promptLower.includes('minimal') || promptLower.includes('clean')) {
      style = 'minimal';
      selectedTop = tops.find(t => t.styles?.includes('minimal') || t.colors?.includes('white') || t.colors?.includes('black')) || tops[0];
      selectedBottom = bottoms.find(b => b.styles?.includes('minimal') || b.colors?.includes('black')) || bottoms[0];
      selectedShoes = shoes.find(s => s.styles?.includes('minimal') || s.colors?.includes('black') || s.colors?.includes('white')) || shoes[0];
      reasoning = 'Minimalist look with clean lines and neutral colors';
    } else if (promptLower.includes('cozy') || promptLower.includes('comfortable')) {
      style = 'casual';
      selectedTop = tops.find(t => t.name.toLowerCase().includes('hoodie') || t.styles?.includes('casual')) || tops[0];
      selectedBottom = bottoms.find(b => b.name.toLowerCase().includes('nike') || b.styles?.includes('casual')) || bottoms[0];
      selectedShoes = shoes.find(s => s.styles?.includes('casual') || s.styles?.includes('sporty')) || shoes[0];
      reasoning = 'Cozy and comfortable outfit for relaxed vibes';
    } else {
      // Default selection
      selectedTop = tops[0];
      selectedBottom = bottoms[0];
      selectedShoes = shoes[0];
      reasoning = `Stylish outfit based on "${prompt}"`;
    }
    
    // Add overshirt if available and style allows
    if (overshirts.length > 0 && (style === 'luxury' || style === 'casual')) {
      selectedOvershirt = overshirts[0];
    }
    
    // Add jacket if available and style allows
    if (jackets.length > 0 && (style === 'streetwear' || style === 'luxury')) {
      selectedJacket = jackets[0];
    }
    
    // Extract colors
    if (selectedTop) colors.push(...(selectedTop.colors || []));
    if (selectedBottom) colors.push(...(selectedBottom.colors || []));
    if (selectedShoes) colors.push(...(selectedShoes.colors || []));
    
    return {
      reasoning,
      style,
      colors: [...new Set(colors)], // Remove duplicates
      top_base: selectedTop?.id || null,
      top_overshirt: selectedOvershirt?.id || null,
      outerwear: selectedJacket?.id || null,
      bottom: selectedBottom?.id || null,
      shoes: selectedShoes?.id || null
    };
  }

  async applyOutfitRecommendation(recommendation, manifest) {
    // Use ONLY uploaded items from wardrobe
    const uploadedItems = manifest?.items || [];
    
    // Find the actual items from uploaded items
    const findItem = (id) => {
      return uploadedItems.find(item => item.id === id);
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
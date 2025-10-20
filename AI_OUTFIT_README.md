# 🤖 AI Outfit Generator

Sistema di raccomandazione outfit basato su AI che usa **Structured Outputs** di OpenAI per generare abbinamenti intelligenti dai tuoi vestiti.

## 🚀 Come Funziona

1. **Clicca [AI FIT]** nella barra inferiore
2. **Descrivi l'outfit** che vuoi (es. "cozy fit", "formal meeting", "sporty look")
3. **L'AI analizza** i tuoi vestiti e sceglie la combinazione migliore
4. **L'outfit viene generato** automaticamente con spiegazioni

## ✨ Caratteristiche

### 🧠 Structured Outputs
- **Schema JSON rigoroso** per risposte consistenti
- **Ragionamento dettagliato** per ogni scelta
- **Validazione automatica** delle raccomandazioni

### 🎯 Prompt Intelligenti
- **Esempi predefiniti**: cozy fit, formal meeting, sporty look, etc.
- **Input libero**: scrivi qualsiasi descrizione
- **Contesto completo**: l'AI conosce tutti i tuoi vestiti

### 🎨 Raccomandazioni Smart
- **Coordinamento colori** automatico
- **Stile coerente** per l'occasione
- **Spiegazioni dettagliate** per ogni pezzo

## 🔧 Setup Tecnico

### 1. API Key OpenAI
```javascript
// Il sistema chiederà automaticamente la tua API key
// Viene salvata in localStorage per uso futuro
```

### 2. Modello Utilizzato
- **GPT-4o-2024-08-06** con Structured Outputs
- **Temperature 0.7** per creatività bilanciata
- **Max tokens 1000** per risposte complete

### 3. Schema JSON
```json
{
  "reasoning": "Brief explanation of why this outfit works",
  "style": "casual|formal|street|sport",
  "outfit": {
    "top_base": { "id": "...", "name": "...", "reason": "..." },
    "top_overshirt": { "id": "...", "name": "...", "reason": "..." },
    "outerwear": { "id": "...", "name": "...", "reason": "..." } | null,
    "bottom": { "id": "...", "name": "...", "reason": "..." },
    "shoes": { "id": "...", "name": "...", "reason": "..." }
  }
}
```

## 📝 Esempi di Prompt

### Casual
- "cozy fit"
- "casual Friday"
- "work from home"
- "weekend errands"

### Formal
- "formal meeting"
- "job interview"
- "business dinner"
- "important presentation"

### Sport
- "sporty look"
- "gym session"
- "running errands"
- "active day"

### Special Occasions
- "date night"
- "party outfit"
- "vacation look"
- "holiday gathering"

## 🛠️ File del Sistema

- `ai-outfit.js` - Classe principale AI Outfit Generator
- `index.html` - Modal e UI per AI
- `main.js` - Integrazione con il sistema esistente
- `test-ai.html` - Pagina di test per debugging

## 🔍 Debug e Test

### Test Page
```
http://localhost:8000/test-ai.html
```

### Console Logs
```javascript
// Attiva i log dettagliati
console.log('AI recommendation:', recommendation);
console.log('Generated outfit:', outfit);
```

### Error Handling
- **API Key mancante**: prompt automatico
- **Rate limiting**: retry automatico
- **Errori di rete**: messaggi chiari
- **Validazione schema**: fallback graceful

## 🎨 Personalizzazione

### Aggiungere Stili
```javascript
// In ai-outfit.js, modifica l'enum style
enum: ["casual", "formal", "street", "sport", "your_style"]
```

### Modificare Esempi
```html
<!-- In index.html, aggiungi nuovi esempi -->
<button class="ai-example" data-prompt="your prompt">Your Label</button>
```

### Aggiustare Schema
```javascript
// In ai-outfit.js, modifica getOutfitSchema()
// per aggiungere nuovi campi o validazioni
```

## 🚀 Prossimi Sviluppi

- [ ] **Stile personalizzato** basato su preferenze utente
- [ ] **Stagionalità** nelle raccomandazioni
- [ ] **Meteo** integrato per outfit appropriati
- [ ] **Storia outfit** per evitare ripetizioni
- [ ] **Rating sistema** per migliorare raccomandazioni

## 💡 Tips per Migliori Risultati

1. **Sii specifico**: "cozy winter fit" vs "cozy fit"
2. **Menziona l'occasione**: "date night outfit" vs "nice outfit"
3. **Includi il mood**: "confident and professional" vs "professional"
4. **Usa esempi**: clicca sui pulsanti predefiniti per iniziare

---

**Powered by OpenAI GPT-4o with Structured Outputs** 🧠✨

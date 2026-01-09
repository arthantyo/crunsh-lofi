# AI-Powered Food-Themed Lofi Generation

## Overview

The audio generator now uses AI to create unique lofi vibes for **ANY food topic**, not just predefined ones!

## How It Works

### 1. **Predefined Foods** (Fast & Free)

These foods have curated variations built-in with randomization:

- Burger, Taco, Pasta, Pizza
- Sushi, Ramen, Coffee
- Dessert, BBQ

Each predefined food has 3-4 variations for:

- Vibes (mood/energy)
- Instruments (sonic character)
- Atmosphere (scene/setting)
- Tempo (pacing)

### 2. **AI-Generated Foods** (Smart & Creative)

For any other food (matcha, croissant, pho, kimchi, etc.), the system uses OpenAI GPT-4o-mini to generate custom lofi vibes.

The AI is trained to create prompts following the same pattern as predefined foods:

```
[vibe] lofi hip hop inspired by [food].
Features [instruments].
Captures [mood].
[tempo].
[optional: time/weather context]
```

## Setup

### Add OpenAI API Key (Optional)

1. Get your API key from [platform.openai.com](https://platform.openai.com)
2. Add to your `.env` file:

```env
OPENAI_API_KEY=sk-your-key-here
```

### Without OpenAI (Fallback)

If no OpenAI key is provided, the system falls back to a generic prompt for unknown foods.

## Examples

### Matcha (AI-Generated)

```
"serene and refreshing lofi hip hop inspired by matcha.
Features gentle bamboo flutes, soft piano, zen-like synth pads with tape warmth.
Captures Japanese tea ceremony atmosphere with mindful tranquility.
Slow tempo with meditative flow. Evokes morning vibes.
Chill, instrumental, perfect for studying or relaxing."
```

### Croissant (AI-Generated)

```
"delicate and buttery lofi hip hop inspired by croissant.
Features warm accordion, soft piano, gentle strings with vinyl crackle.
Captures Parisian cafe morning with sophisticated elegance.
Relaxed tempo with flowing melodies. Perfect for misty morning.
Chill, instrumental, perfect for studying or relaxing."
```

### Burger (Predefined + Randomized)

```
"funky and bold lofi hip hop inspired by burger.
Features smooth rhodes, punchy drums, rich synth pads with tape warmth.
Captures street food soul with urban flavor.
Mid-tempo with bouncy feel. Evokes late-night vibes.
Chill, instrumental, perfect for studying or relaxing."
```

## Benefits

✅ **Works for ANY food** - No more generic prompts  
✅ **Culturally appropriate** - AI understands food origins and associations  
✅ **Always unique** - High temperature (0.9) ensures variation  
✅ **Consistent quality** - Follows proven patterns from predefined foods  
✅ **Automatic fallback** - Works even without OpenAI key

## Cost

OpenAI GPT-4o-mini costs approximately:

- **~$0.0001 per prompt** (less than a penny)
- Even generating 1000 unique prompts = ~$0.10

## Usage

Just use any food name in your video title:

- "Matcha Lofi Beats"
- "Pho Vibes - Study Music"
- "Croissant Chill Session"
- "Kimchi Late Night Study"

The system automatically detects the food and generates the perfect vibe! 🎵

# Open Graph Image Guide

This folder should contain your social media preview image.

## Required File
**Filename:** `og-image.png`

## Specifications
- **Dimensions:** 1200 x 630 pixels
- **Format:** PNG (for best quality) or JPG
- **File size:** Keep under 1MB for fast loading

## Design Recommendations

### Layout
```
┌─────────────────────────────────────┐
│                                     │
│         🎮 My Switch Library        │
│                                     │
│   Track Your Nintendo Switch        │
│       Game Collection               │
│                                     │
│   • Search & Add Games              │
│   • Share Your Library              │
│   • Compare with Friends            │
│                                     │
└─────────────────────────────────────┘
```

### Colors
- Background: Dark (#1a1a1a) or Nintendo red (#e60012)
- Text: White (#ffffff) for contrast
- Accent: Nintendo Switch blue/red

### Text Content Ideas
**Option 1 - Feature Focused:**
- Main heading: "My Switch Library"
- Tagline: "Track Your Nintendo Switch Collection"
- Bullet points of key features

**Option 2 - Benefit Focused:**
- Main heading: "Never Forget Your Games"
- Tagline: "The ultimate Nintendo Switch game tracker"
- Call to action: "Start tracking today"

**Option 3 - Social Focused:**
- Main heading: "My Switch Library"
- Tagline: "Share & compare your game collection"
- Social proof: "Join collectors tracking their games"

## Design Tools

### Free Options
1. **Canva** (canva.com)
   - Search for "Open Graph" or "Social Media" templates
   - Use 1200x630px dimensions
   - Free stock photos and elements

2. **Figma** (figma.com)
   - Create 1200x630 frame
   - Use community templates
   - Export as PNG

### Paid Options
1. **Photoshop** - Professional control
2. **Sketch** - Mac-only design tool
3. **Affinity Designer** - One-time purchase

## Quick Generation Services
If you need something fast, try these AI/automated tools:
- **Bannerbear** - Automated image generation
- **OG Image Generator** - Simple text-based generator
- **Placid** - Template-based generation

## Testing Your Image

After creating your image, test it:
1. Place it in `/public/og-image.png`
2. Build and deploy your site
3. Test with:
   - Facebook Sharing Debugger
   - Twitter Card Validator
   - LinkedIn Post Inspector

## Safe Zone
Keep all important text and elements within the center 1000x450px area, as some platforms crop the edges.

## Example Command to Create Placeholder
If you just need a temporary placeholder:

```bash
# Create a simple 1200x630 colored rectangle (macOS)
# This creates a basic PNG - replace with a proper design later
sips -z 630 1200 -s format png /path/to/source.png --out public/og-image.png
```

Or use an online tool like:
- https://www.opengraph.xyz/
- https://ogimage.gallery/

## Current Status
✅ **COMPLETE:** `og-image.png` has been created and added to the `/public` folder

**Current specifications:**
- Dimensions: 1200x630 pixels ✅
- Format: PNG ✅
- File size: 757KB (under 1MB limit) ✅
- Aspect ratio: 1.91:1 ✅

The meta tags are configured to use this image. Social media platforms will display it when your site is shared.

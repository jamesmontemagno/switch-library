# SEO Enhancement Guide

This document explains the SEO improvements made to the My Switch Library application and how to maintain them.

## 📋 What Was Added

### 1. **Custom SEO Hook** (`src/hooks/useSEO.ts`)
A reusable React hook that dynamically updates meta tags for any page.

**Usage Example:**
```typescript
import { useSEO } from '../hooks/useSEO';

function MyPage() {
  useSEO({
    title: 'My Custom Page Title',
    description: 'This is what will show in search results',
    url: 'https://myswitchlibrary.com/my-page',
    image: 'https://myswitchlibrary.com/my-image.png',
    type: 'website', // or 'profile', 'article', etc.
  });
  
  return <div>Your content</div>;
}
```

### 2. **Structured Data (JSON-LD)**
Added to `index.html` to help search engines understand the site better. This improves rich snippet display in search results.

### 3. **Dynamic Meta Tags for Shared Libraries**
The `SharedLibrary` component now updates meta tags based on the library owner's name and game count.

**Important Note:** These dynamic meta tags work for:
- Google Search (executes JavaScript for indexing)
- User browser experience (page titles, bookmarks)
- Navigation within the app

However, **social media crawlers** (Facebook, Twitter, LinkedIn) don't execute JavaScript, so they will see the default meta tags from `index.html`. This is a common limitation of Single Page Applications (SPAs).

**Solutions for dynamic social previews:**
1. **Pre-rendering service**: Use a service like Prerender.io or Rendertron
2. **Static Site Generation**: Convert to Next.js or similar with SSR/SSG
3. **Accept the limitation**: Use the generic og-image for all shares (simplest)

### 4. **Enhanced Sitemap**
Updated `public/sitemap.xml` with:
- All main pages
- Proper priority and change frequency
- Last modified dates

## 🎨 Creating an Open Graph Image

You'll want to create an appealing social preview image at `/public/og-image.png`.

**Recommended specifications:**
- **Size:** 1200x630 pixels
- **Format:** PNG or JPG
- **Content ideas:**
  - App logo
  - Nintendo Switch image
  - Text: "My Switch Library"
  - Tagline: "Track Your Game Collection"

**Design tips:**
- Keep important elements centered (some platforms crop edges)
- Use high contrast colors
- Include your branding
- Test on multiple platforms (Facebook, Twitter, LinkedIn)

**Tools you can use:**
- Canva (has social media templates)
- Figma
- Photoshop
- Free online OG image generators

## 🚀 Deployment Steps

1. Build the app: `npm run build`
2. Deploy to your hosting (GitHub Pages, Netlify, Vercel, etc.)
3. Ensure the `og-image.png` is in the `public` folder and gets deployed

The static meta tags in `index.html` will be used by social media crawlers. The dynamic meta tags (via `useSEO` hook) enhance the experience for users and search engines that execute JavaScript.

## 🔍 Testing Your SEO

### Test Meta Tags:
1. **Facebook Debugger:** https://developers.facebook.com/tools/debug/
2. **Twitter Card Validator:** https://cards-dev.twitter.com/validator
3. **LinkedIn Post Inspector:** https://www.linkedin.com/post-inspector/
4. **Open Graph Check:** https://www.opengraph.xyz/

### Test Structured Data:
1. **Google Rich Results Test:** https://search.google.com/test/rich-results
2. **Schema Markup Validator:** https://validator.schema.org/

### Test General SEO:
1. **Google Search Console:** Add your site and monitor performance
2. **Lighthouse:** Run in Chrome DevTools (Audits tab)

## 📱 Social Media Preview Behavior

### What Users Will See
When sharing any page from My Switch Library on social media:
- **Generic preview** with your og-image.png
- **Title**: "My Switch Library - Track Your Nintendo Switch Game Collection"
- **Description**: Generic site description from index.html

### Why Not Dynamic?
Social media crawlers (Facebook, Twitter, etc.) don't execute JavaScript. They only read the initial HTML. Since this is a Single Page Application (SPA), dynamic content loaded by React isn't visible to these crawlers.

### Options for Dynamic Previews

**Option 1: Accept Static Previews (Recommended for now)**
- Simplest approach
- Works with current architecture
- All shared links show the same appealing preview

**Option 2: Pre-rendering Service**
Services like Prerender.io cache rendered pages for crawlers:
- Detects crawler user agents
- Serves pre-rendered HTML to crawlers
- Regular users get the normal SPA
- Cost: Usually $20-50/month

**Option 3: Migrate to SSR/SSG**
Rebuild with Next.js, Remix, or similar:
- Full server-side rendering capabilities
- Dynamic meta tags for crawlers
- Requires architecture change

## 🛠️ Maintenance

### Updating SEO for New Pages
When adding a new page, use the `useSEO` hook to set custom meta tags:

```typescript
import { useSEO } from '../hooks/useSEO';

export function NewPage() {
  useSEO({
    title: 'New Page - My Switch Library',
    description: 'Description for this page',
    url: 'https://myswitchlibrary.com/new-page',
  });
  
  return <div>Content</div>;
}
```

### Updating the Sitemap
When you add new static pages, update `public/sitemap.xml`:

```xml
<url>
  <loc>https://myswitchlibrary.com/new-page</loc>
  <lastmod>2026-01-09</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

## 📊 Monitoring

Track your SEO performance using:
1. **Google Analytics** - Traffic sources and user behavior
2. **Google Search Console** - Search performance and indexing
3. **Social media analytics** - Share performance

## 🐛 Troubleshooting

### Social previews not showing custom image?
- Verify og-image.png exists in `/public` folder
- Check that the file is accessible at `https://yourdomain.com/og-image.png`
- Clear social media cache using their debug tools
- Ensure the image is 1200x630px and under 1MB
- Check that index.html has the correct og:image URL

### Dynamic content not appearing in social previews?
- This is expected behavior for SPAs
- Social media crawlers don't execute JavaScript
- They will see the static meta tags from index.html
- Consider the options listed above for dynamic previews

### Pages not appearing in search?
- Submit sitemap to Google Search Console
- Check robots.txt isn't blocking pages
- Wait (indexing can take days or weeks)
- Build backlinks from other sites

### Meta tags not updating?
- Clear browser cache
- Check that the `useSEO` hook is being called
- Verify the component is actually rendering
- Use browser dev tools to inspect the `<head>` tag

## 🎯 Next Steps

1. ✅ **og-image.png created** - Properly sized and optimized (1200x630px, 757KB)
2. **Test social sharing** using the debugging tools above
3. **Submit sitemap** to Google Search Console
4. **Monitor performance** and iterate on meta descriptions
5. **Consider pre-rendering** if dynamic social previews become important

import { useEffect } from 'react';

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  keywords?: string;
}

const defaultSEO: Required<SEOProps> = {
  title: 'My Switch Library - Track Your Nintendo Switch Game Collection',
  description: 'Track, organize, and share your Nintendo Switch and Switch 2 game collection. Search games, add physical and digital titles, and manage your library with ease.',
  image: 'https://myswitchlibrary.com/og-image.png',
  url: 'https://myswitchlibrary.com/',
  type: 'website',
  keywords: 'Nintendo Switch, Switch 2, game collection, game tracker, library manager, Nintendo games, video game collection',
};

export function useSEO(props: SEOProps = {}) {
  useEffect(() => {
    const seo = { ...defaultSEO, ...props };
    
    // Update title
    document.title = seo.title;
    
    // Helper to update or create meta tags
    const updateMetaTag = (selector: string, content: string) => {
      let element = document.querySelector(selector);
      if (element) {
        element.setAttribute('content', content);
      } else {
        element = document.createElement('meta');
        const parts = selector.match(/\[(.+?)="(.+?)"\]/);
        if (parts) {
          element.setAttribute(parts[1], parts[2]);
          element.setAttribute('content', content);
          document.head.appendChild(element);
        }
      }
    };
    
    // Update standard meta tags
    updateMetaTag('meta[name="description"]', seo.description);
    updateMetaTag('meta[name="keywords"]', seo.keywords);
    
    // Update Open Graph tags
    updateMetaTag('meta[property="og:title"]', seo.title);
    updateMetaTag('meta[property="og:description"]', seo.description);
    updateMetaTag('meta[property="og:image"]', seo.image);
    updateMetaTag('meta[property="og:url"]', seo.url);
    updateMetaTag('meta[property="og:type"]', seo.type);
    
    // Update Twitter tags
    updateMetaTag('meta[property="twitter:title"]', seo.title);
    updateMetaTag('meta[property="twitter:description"]', seo.description);
    updateMetaTag('meta[property="twitter:image"]', seo.image);
    updateMetaTag('meta[property="twitter:url"]', seo.url);
    
    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) {
      canonical.href = seo.url;
    } else {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = seo.url;
      document.head.appendChild(canonical);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.title, props.description, props.image, props.url, props.type, props.keywords]);
}

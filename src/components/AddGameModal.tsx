import { useState, useRef, useEffect } from 'react';
import type { GameEntry, Platform, Format, GameMetadata } from '../types';
import { 
  searchGames, 
  getGameById, 
  getGameImages, 
  getBoxartUrl,
  PLATFORM_IDS,
  DEFAULT_REGIONS,
  isTheGamesDBConfigured,
  type TheGamesDBGame 
} from '../services/thegamesdb';
import { usePreferences } from '../hooks/usePreferences';
import './AddGameModal.css';

// Type declaration for BarcodeDetector API (not yet in standard TypeScript types)
interface BarcodeDetector {
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetector;
    };
  }
}

interface AddGameModalProps {
  onClose: () => void;
  onAdd: (game: Omit<GameEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void | Promise<void>;
}

type SearchState = 'idle' | 'searching' | 'results' | 'no-results' | 'error';

interface SearchResultItem {
  id: number;
  title: string;
  releaseDate?: string;
  platform: string;
  overview?: string;
  boxartUrl?: string;
}

export function AddGameModal({ onClose, onAdd }: AddGameModalProps) {
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<Platform>('Nintendo Switch');
  const [format, setFormat] = useState<Format>('Physical');
  const [barcode, setBarcode] = useState('');
  
  // Preferences
  const { preferences, updatePreferences } = usePreferences();
  const [showSettings, setShowSettings] = useState(false);
  
  // Additional details (optional)
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [completed, setCompleted] = useState(false);
  const [completedDate, setCompletedDate] = useState('');
  
  // TheGamesDB search state
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [sortBy, setSortBy] = useState<'release_desc' | 'release_asc' | 'title_asc'>('release_desc');
  const [filterYear, setFilterYear] = useState('');
  const [onlyBoxart, setOnlyBoxart] = useState(false);
  const [selectedGame, setSelectedGame] = useState<TheGamesDBGame | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [gameMetadata, setGameMetadata] = useState<GameMetadata | null>(null);
  const [thegamesdbId, setThegamesdbId] = useState<number | undefined>(undefined);
  
  // Barcode scanning state
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // OCR state
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrSuggestions, setOcrSuggestions] = useState<string[]>([]);
  const [showOcrSuggestions, setShowOcrSuggestions] = useState(false);
  
  // Abort controller for search requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  const hasTheGamesDB = isTheGamesDBConfigured();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      stopBarcodeScanning();
    };
  }, []);

  const handleSearchTheGamesDB = async () => {
    const query = searchQuery.trim() || title.trim();
    if (!query || !hasTheGamesDB) return;

    // Abort any previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const requestId = ++searchRequestIdRef.current;

    setSearchState('searching');
    setSearchResults([]);
    setSelectedGame(null);
    setCoverUrl(null);
    setGameMetadata(null);
    setThegamesdbId(undefined);

    try {
      const platformId = platform === 'Nintendo Switch' 
        ? PLATFORM_IDS.NINTENDO_SWITCH 
        : PLATFORM_IDS.NINTENDO_SWITCH_2;
      
      const result = await searchGames(query, { 
        platformId,
        regions: DEFAULT_REGIONS,
      });
      
      // Check if this is still the latest request
      if (requestId !== searchRequestIdRef.current) {
        return; // Ignore stale results
      }

      if (result.count === 0) {
        setSearchState('no-results');
      } else {
        // Fetch images for all results to show boxart
        const resultsWithImages = await Promise.all(
          result.games.map(async (game) => {
            const images = await getGameImages(game.id);
            const boxartUrl = getBoxartUrl(images, game.id, 'small');
            return {
              id: game.id,
              title: game.game_title,
              releaseDate: game.release_date,
              platform: 'Nintendo Switch',
              overview: game.overview,
              boxartUrl: boxartUrl || undefined,
            };
          })
        );
        let filtered = resultsWithImages;
        if (onlyBoxart) {
          filtered = filtered.filter(r => !!r.boxartUrl);
        }
        if (filterYear) {
          filtered = filtered.filter(r => r.releaseDate?.startsWith(filterYear));
        }
        const parseDate = (d?: string) => (d ? new Date(d).getTime() : 0);
        filtered = [...filtered].sort((a, b) => {
          if (sortBy === 'title_asc') return a.title.localeCompare(b.title);
          if (sortBy === 'release_asc') return parseDate(a.releaseDate) - parseDate(b.releaseDate);
          // default release_desc
          return parseDate(b.releaseDate) - parseDate(a.releaseDate);
        });
        setSearchResults(filtered);
        setSearchState('results');
      }
    } catch (error) {
      if (requestId === searchRequestIdRef.current) {
        console.error('Search error:', error);
        setSearchState('error');
      }
    }
  };

  const handleSelectGame = async (gameId: number) => {
    setSearchState('searching');
    
    try {
      const [gameData, imagesData] = await Promise.all([
        getGameById(gameId),
        getGameImages(gameId)
      ]);

      if (gameData) {
        setSelectedGame(gameData);
        setThegamesdbId(gameData.id);
        
        // Extract cover URL
        const cover = getBoxartUrl(imagesData, gameId, 'medium');
        setCoverUrl(cover);
        
        // Build metadata - store IDs as-is for now, can be enriched later
        // TheGamesDB returns numeric IDs for genres, developers, and publishers
        // These can be resolved to names via additional API calls or lookup tables
        const metadata: GameMetadata = {
          genres: gameData.genres?.map(String),
          releaseDate: gameData.release_date,
          developer: gameData.developers?.[0]?.toString(),
          publisher: gameData.publishers?.[0]?.toString(),
          summary: gameData.overview,
          players: gameData.players,
          rating: gameData.rating,
        };
        setGameMetadata(metadata);
        
        // Update title if user hasn't modified it
        setTitle(gameData.game_title);
      }
      
      setSearchState('idle');
    } catch (error) {
      console.error('Failed to fetch game details:', error);
      setSearchState('error');
    }
  };

  const startBarcodeScanning = async () => {
    if (!window.BarcodeDetector) {
      alert('Barcode scanning is not supported in this browser. Please enter the barcode manually.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setIsScanning(true);
      detectBarcode();
    } catch (error) {
      console.error('Failed to start camera:', error);
      alert('Failed to access camera. Please check permissions.');
    }
  };

  const detectBarcode = async () => {
    if (!videoRef.current || !streamRef.current || !window.BarcodeDetector) return;

    try {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'upc_e'] });
      const barcodes = await barcodeDetector.detect(videoRef.current);
      
      if (barcodes.length > 0) {
        setBarcode(barcodes[0].rawValue);
        stopBarcodeScanning();
      } else {
        // Keep detecting with a small delay to reduce CPU usage
        setTimeout(() => requestAnimationFrame(detectBarcode), 100);
      }
    } catch (error) {
      console.error('Barcode detection error:', error);
      setTimeout(() => requestAnimationFrame(detectBarcode), 100);
    }
  };

  const stopBarcodeScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleOCRImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOCRProcessing(true);
    setOcrSuggestions([]);

    try {
      // Dynamically import Tesseract.js
      const Tesseract = await import('tesseract.js');
      
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        // Only log in development mode
        logger: import.meta.env.DEV ? (m) => console.log(m) : undefined,
      });

      // Extract potential game titles from the text
      const lines = text.split('\n').filter(line => line.trim().length > 3);
      const suggestions = lines
        .slice(0, 5) // Take first 5 lines
        .map(line => line.trim())
        .filter(line => line.length < 100); // Filter out very long lines

      setOcrSuggestions(suggestions);
      setShowOcrSuggestions(true);
    } catch (error) {
      console.error('OCR error:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsOCRProcessing(false);
    }
  };

  const applyOcrSuggestion = (suggestion: string) => {
    setTitle(suggestion);
    setShowOcrSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      platform,
      purchaseDate: purchaseDate || undefined,
      completed: completed || undefined,
      completedDate: completedDate || undefined,
      format,
      barcode: barcode.trim() || undefined,
      status: 'Owned',
      thegamesdbId,
      coverUrl: coverUrl || undefined,
      gameMetadata: gameMetadata || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hasTheGamesDB && (searchQuery.trim() || title.trim()) && searchState === 'idle') {
      e.preventDefault();
      handleSearchTheGamesDB();
    }
  };

  const toggleRegion = (region: string) => {
    const regions = preferences.searchRegions.includes(region)
      ? preferences.searchRegions.filter(r => r !== region)
      : [...preferences.searchRegions, region];
    updatePreferences({ searchRegions: regions.length > 0 ? regions : ['US'] });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="modal-title">Add Game</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="mode-tabs">
            <button
              type="button"
              className={`mode-tab ${mode === 'search' ? 'active' : ''}`}
              onClick={() => setMode('search')}
            >
              🔎 Search
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              ✍️ Manual
            </button>
          </div>
          <div className="form-group">
            <label htmlFor="title">Game Title *</label>
            <div className="input-with-actions">
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={mode === 'search' ? undefined : handleKeyDown}
                placeholder="Enter game title"
                required
                autoFocus
              />
            </div>
            
            {/* OCR Helper */}
            <div className="helper-actions">
              <label htmlFor="ocr-upload" className="btn-helper">
                📷 Scan Box Text
                <input
                  id="ocr-upload"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleOCRImageUpload}
                  style={{ display: 'none' }}
                  disabled={isOCRProcessing}
                />
              </label>
              {isOCRProcessing && <span className="helper-status">Processing...</span>}
            </div>
            
            {/* OCR Suggestions */}
            {showOcrSuggestions && ocrSuggestions.length > 0 && (
              <div className="ocr-suggestions">
                <div className="ocr-suggestions-header">
                  <span>Suggested Titles:</span>
                  <button 
                    type="button" 
                    onClick={() => setShowOcrSuggestions(false)}
                    className="btn-close-suggestions"
                  >
                    ✕
                  </button>
                </div>
                {ocrSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applyOcrSuggestion(suggestion)}
                    className="ocr-suggestion-item"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TheGamesDB Search - Search Mode */}
          {mode === 'search' && hasTheGamesDB && (
            <div className="form-group">
              <div className="form-group">
                <label htmlFor="searchQuery">Search</label>
                <input
                  id="searchQuery"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search games..."
                />
              </div>

              <div className="search-header">
                <button
                  type="button"
                  onClick={handleSearchTheGamesDB}
                  disabled={!(searchQuery.trim() || title.trim()) || searchState === 'searching'}
                  className="btn-search"
                >
                  {searchState === 'searching' ? '🔍 Searching...' : '🔍 Search TheGamesDB'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="btn-settings"
                  title="Search preferences"
                >
                  ⚙️
                </button>
              </div>

              <div className="search-filters">
                <div className="filter-group">
                  <label htmlFor="sortBy">Sort</label>
                  <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                    <option value="release_desc">Release Date ↓</option>
                    <option value="release_asc">Release Date ↑</option>
                    <option value="title_asc">Title A-Z</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filterYear">Year</label>
                  <input
                    id="filterYear"
                    type="text"
                    inputMode="numeric"
                    pattern="\\d{4}"
                    maxLength={4}
                    placeholder="YYYY"
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                  />
                </div>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={onlyBoxart}
                    onChange={e => setOnlyBoxart(e.target.checked)}
                  />
                  <span>Only with boxart</span>
                </label>
              </div>
              
              {/* Search Settings */}
              {showSettings && (
                <div className="search-settings">
                  <h4>Search Regions</h4>
                  <p className="settings-description">Select which regions to include in game searches</p>
                  <div className="region-toggles">
                    {['US', 'EU', 'JP', 'AU', 'KR'].map(region => (
                      <label key={region} className="region-toggle">
                        <input
                          type="checkbox"
                          checked={preferences.searchRegions.includes(region)}
                          onChange={() => toggleRegion(region)}
                        />
                        <span>{region}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              {searchState === 'no-results' && (
                <p className="search-message">No results found. You can still add the game manually.</p>
              )}
              
              {searchState === 'error' && (
                <p className="search-message error">Search failed. Please try again.</p>
              )}
              
              {searchState === 'results' && searchResults.length > 0 && (
                <div className="search-results">
                  <p className="search-results-header">Select a match:</p>
                  {searchResults.map(result => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelectGame(result.id)}
                      className="search-result-item-detailed"
                    >
                      {result.boxartUrl && (
                        <img 
                          src={result.boxartUrl} 
                          alt={result.title} 
                          className="result-boxart"
                        />
                      )}
                      <div className="result-details">
                        <span className="result-title">{result.title}</span>
                        {result.releaseDate && (
                          <span className="result-date">📅 {result.releaseDate}</span>
                        )}
                        {result.overview && (
                          <p className="result-overview">
                            {result.overview.length > 150 
                              ? `${result.overview.substring(0, 150)}...` 
                              : result.overview}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {selectedGame && (
                <div className="selected-game-preview">
                  <p className="preview-label">✓ Selected: {selectedGame.game_title}</p>
                  {coverUrl && (
                    <img src={coverUrl} alt={selectedGame.game_title} className="preview-cover" />
                  )}
                </div>
              )}
            </div>
          )}

          {(mode === 'manual' || selectedGame) && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="platform">Platform</label>
              <select
                id="platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
              >
                <option value="Nintendo Switch">Nintendo Switch</option>
                <option value="Nintendo Switch 2">Nintendo Switch 2</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="format">Format</label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
              >
                <option value="Physical">Physical</option>
                <option value="Digital">Digital</option>
              </select>
            </div>
          </div>
          )}

          {(mode === 'manual' || selectedGame) && (
          <div className="form-group">
            <label htmlFor="barcode">Barcode (optional)</label>
            <div className="input-with-actions">
              <input
                id="barcode"
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Enter UPC/EAN barcode"
              />
            </div>
            
            {/* Barcode Scanner */}
            <div className="helper-actions">
              {!isScanning && (
                <button
                  type="button"
                  onClick={startBarcodeScanning}
                  className="btn-helper"
                >
                  📸 Scan Barcode
                </button>
              )}
              {isScanning && (
                <button
                  type="button"
                  onClick={stopBarcodeScanning}
                  className="btn-helper btn-cancel"
                >
                  ✕ Cancel Scan
                </button>
              )}
            </div>
            
            {/* Barcode Scanner Video */}
            {isScanning && (
              <div className="barcode-scanner">
                <video ref={videoRef} className="scanner-video" playsInline />
                <p className="scanner-instruction">Point camera at barcode</p>
              </div>
            )}
          </div>
          )}

          {/* Additional Details (Optional) */}
          <div className="form-group">
            <button
              type="button"
              onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
              className="btn-toggle-section"
            >
              {showAdditionalDetails ? '▼' : '▶'} Additional Details (Optional)
            </button>
            
            {showAdditionalDetails && (
              <div className="additional-details">
                <div className="form-group">
                  <label htmlFor="purchaseDate">Purchase Date</label>
                  <input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(e) => {
                        setCompleted(e.target.checked);
                        if (!e.target.checked) {
                          setCompletedDate('');
                        }
                      }}
                    />
                    <span>Completed/Beaten</span>
                  </label>
                </div>

                {completed && (
                  <div className="form-group">
                    <label htmlFor="completedDate">Completion Date</label>
                    <input
                      id="completedDate"
                      type="date"
                      value={completedDate}
                      onChange={(e) => setCompletedDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={!title.trim()}>
              Add Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

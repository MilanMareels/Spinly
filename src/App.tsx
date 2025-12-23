import React, { useState, useEffect, useRef } from "react";
import { Search, Disc, Barcode, Plus, Trash2, X, Music, Info, Loader2, Camera, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type { SearchResult, CollectionItem, ReleaseDetail, PaginationData } from "./types";

export default function App() {
  // --- State Management ---
  const [apiToken, setApiToken] = useState<string>("GhzcNyHfWQyyIrsJNNvLsuMvLfzsHkcFpkrEpHtE");
  const [query, setQuery] = useState<string>("");
  const [searchType, setSearchType] = useState<string>("q");

  // Data States
  const [results, setResults] = useState<SearchResult[]>([]);
  // DUMMY_COLLECTION is verwijderd, we starten met een lege array
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<ReleaseDetail | null>(null);

  // UI States
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("search");
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Pagination States
  const [searchPagination, setSearchPagination] = useState<PaginationData>({ page: 1, pages: 1, items: 0, per_page: 25 });
  const [collectionPage, setCollectionPage] = useState<number>(1);
  const ITEMS_PER_PAGE_COLLECTION = 25;

  // Initial Load (Home Page Content)
  useEffect(() => {
    if (apiToken || isDemoMode) {
      // Voer een standaard zoekopdracht uit om de home page te vullen
      performSearch(query, 1, "q", true); // true = isInitialLoad
    }
  }, [apiToken, isDemoMode]);

  // --- API Functies ---

  const getHeaders = () => {
    return {
      Authorization: `Discogs token=${apiToken}`,
      "User-Agent": "DiscogsExplorerApp/1.0",
    };
  };

  const performSearch = async (searchQuery: string, page: number = 1, type: string = searchType, isInitialLoad: boolean = false) => {
    if ((!searchQuery && !isInitialLoad) || (!apiToken && !isDemoMode)) return;

    setLoading(true);
    setError(null);

    // Reset results als het een nieuwe zoekopdracht is (geen paginering)
    if (page === 1) setResults([]);

    if (isDemoMode) {
      setTimeout(() => {
        const demoResults = Array.from({ length: 25 }).map((_, i) => ({
          id: 100 + i + page * 25,
          title: searchQuery ? `Demo Resultaat ${i + 1} voor "${searchQuery}"` : `Trending Album ${i + 1} (Pagina ${page})`,
          year: "2023",
          label: ["Demo Records"],
          thumb: "",
          resource_url: "",
        }));

        setResults(demoResults);
        setSearchPagination({ page, pages: 5, items: 125, per_page: 25 });
        setLoading(false);
      }, 800);
      return;
    }

    try {
      let url = `https://api.discogs.com/database/search?type=release&per_page=25&page=${page}`;

      if (isInitialLoad && !searchQuery) {
        // "Home page" query: bijvoorbeeld meest populair of recent
        url += `&year=${new Date().getFullYear()}&sort=year&sort_order=desc`;
      } else {
        if (type === "barcode") {
          url += `&barcode=${encodeURIComponent(searchQuery)}`;
        } else {
          url += `&q=${encodeURIComponent(searchQuery)}`;
        }
      }

      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        if (response.status === 401) throw new Error("API Token is ongeldig.");
        throw new Error("Er ging iets mis bij het ophalen van data.");
      }

      const data = await response.json();
      setResults(data.results || []);
      setSearchPagination(data.pagination || { page: 1, pages: 1, items: 0, per_page: 25 });

      if (data.results.length === 0) setError("Geen resultaten gevonden.");
    } catch (err: any) {
      setError(err.message || "Onbekende fout");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= searchPagination.pages) {
      performSearch(query, newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const fetchDetails = async (id: number, resourceUrl?: string) => {
    setLoading(true);
    if (isDemoMode) {
      setTimeout(() => {
        setSelectedRelease({
          id: id,
          title: "Demo Album Details",
          year: "2023",
          artists: [{ name: "Demo Artist" }],
          tracklist: [
            { position: "A1", title: "Intro", duration: "2:30" },
            { position: "A2", title: "Track 2", duration: "4:15" },
          ],
          notes: "Demo modus details.",
        });
        setLoading(false);
      }, 500);
      return;
    }

    try {
      const url = resourceUrl || `https://api.discogs.com/releases/${id}`;
      const response = await fetch(url, { headers: getHeaders() });
      if (!response.ok) throw new Error("Kon details niet ophalen.");
      const data = await response.json();
      setSelectedRelease(data);
    } catch (err: any) {
      setError("Fout bij laden details: " + (err.message || "Onbekende fout"));
    } finally {
      setLoading(false);
    }
  };

  // --- Collectie Management ---
  const addToCollection = (album: CollectionItem) => {
    if (collection.find((item) => item.id === album.id)) {
      alert("Dit album zit al in je collectie!");
      return;
    }
    setCollection([album, ...collection]);
    setActiveTab("collection");
    setSelectedRelease(null);
  };

  const removeFromCollection = (id: number) => {
    setCollection(collection.filter((item) => item.id !== id));
  };

  // Paginering voor collectie (client-side)
  const paginatedCollection = collection.slice((collectionPage - 1) * ITEMS_PER_PAGE_COLLECTION, collectionPage * ITEMS_PER_PAGE_COLLECTION);
  const collectionTotalPages = Math.ceil(collection.length / ITEMS_PER_PAGE_COLLECTION);

  // --- UI Components ---

  // REAL SCANNER IMPLEMENTATION met QuaggaJS
  const ScannerModal = () => {
    const scannerRef = useRef<HTMLDivElement>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [initStatus, setInitStatus] = useState<string>("Initialiseren...");
    const [isHttps, setIsHttps] = useState(true);

    useEffect(() => {
      // Check for HTTPS (behalve op localhost)
      if (window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        setIsHttps(false);
      }
    }, []);

    useEffect(() => {
      if (!isScanning) return;

      const initQuagga = () => {
        setInitStatus("Camera starten...");
        const Quagga = (window as any).Quagga;

        if (Quagga) {
          Quagga.init(
            {
              inputStream: {
                name: "Live",
                type: "LiveStream",
                target: scannerRef.current,
                constraints: {
                  facingMode: "environment",
                  // Geen specifieke resolutie eisen om mobiele compatibiliteit te verhogen
                },
              },
              locator: {
                patchSize: "medium",
                halfSample: true,
              },
              numOfWorkers: 2,
              decoder: {
                readers: ["ean_reader", "upc_reader"],
              },
              locate: true,
            },
            (err: any) => {
              if (err) {
                console.error("Quagga init error:", err);
                if (err.name === "NotAllowedError" || err.message?.includes("permission")) {
                  setScanError("Toegang geweigerd. Sta camera toe in je instellingen.");
                } else if (err.name === "OverconstrainedError") {
                  setScanError("Camera resolutie niet ondersteund. Probeer een ander apparaat.");
                } else {
                  setScanError(`Camera fout: ${err.name || err.message || "Onbekend"}`);
                }
                setInitStatus("");
                return;
              }
              setInitStatus("");
              Quagga.start();
            }
          );

          Quagga.onDetected((data: any) => {
            if (data && data.codeResult && data.codeResult.code) {
              const code = data.codeResult.code;
              if (code.length >= 8) {
                Quagga.stop();
                setQuery(code);
                setSearchType("barcode");
                setIsScanning(false);
                performSearch(code, 1, "barcode");
              }
            }
          });
        } else {
          setScanError("Scanner bibliotheek niet geladen.");
        }
      };

      const requestPermissionAndStart = async () => {
        setInitStatus("Toestemming vragen...");

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setScanError("Je browser ondersteunt geen camera toegang.");
          setInitStatus("");
          return;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          stream.getTracks().forEach((track) => track.stop());
          initQuagga();
        } catch (err: any) {
          console.error("Permission denied or camera error:", err);
          setInitStatus("");
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setScanError("Toegang tot camera geweigerd. Klik op het slotje in je adresbalk om toegang te geven.");
          } else if (err.name === "NotFoundError") {
            setScanError("Geen camera gevonden.");
          } else {
            setScanError("Kon camera niet starten. Sluit andere apps die de camera gebruiken.");
          }
        }
      };

      if (!(window as any).Quagga) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js";
        script.async = true;
        script.onload = requestPermissionAndStart;
        script.onerror = () => {
          setScanError("Kon scanner software niet laden. Check internet.");
          setInitStatus("");
        };
        document.body.appendChild(script);
      } else {
        requestPermissionAndStart();
      }

      return () => {
        if ((window as any).Quagga) {
          try {
            (window as any).Quagga.stop();
          } catch (e) {
            console.warn("Stop error", e);
          }
        }
      };
    }, [isScanning]);

    const handleSimulatedScan = () => {
      const fakeBarcode = "88883716861";
      setQuery(fakeBarcode);
      setSearchType("barcode");
      setIsScanning(false);
      performSearch(fakeBarcode, 1, "barcode");
    };

    if (!isScanning) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="relative flex-1 bg-black overflow-hidden flex flex-col items-center justify-center">
          <div
            ref={scannerRef}
            className="absolute inset-0 w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full [&>canvas]:hidden"
          ></div>

          {initStatus && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white z-20 flex flex-col items-center bg-black/50 p-4 rounded-lg backdrop-blur-sm">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span className="font-medium">{initStatus}</span>
            </div>
          )}

          {!isHttps && !scanError && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-4/5 text-center bg-yellow-600/90 p-3 rounded text-white z-20 text-xs">
              <div className="flex items-center justify-center gap-2 font-bold mb-1">
                <Lock size={14} /> Waarschuwing
              </div>
              Camera werkt mogelijk niet omdat de verbinding niet beveiligd is (geen HTTPS).
            </div>
          )}

          {scanError && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 text-center bg-red-900/90 p-6 rounded-xl text-white z-20 border border-red-500 shadow-2xl">
              <p className="font-bold mb-2 text-lg">Camera Fout</p>
              <p className="text-sm mb-4">{scanError}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setIsScanning(false)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded text-sm transition-colors">
                  Sluiten
                </button>
                <button
                  onClick={handleSimulatedScan}
                  className="bg-white text-red-900 px-4 py-2 rounded text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Gebruik Test Data
                </button>
              </div>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-72 h-48 border-2 border-red-500/50 rounded-lg relative shadow-[0_0_0_100vmax_rgba(0,0,0,0.6)]">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 animate-pulse shadow-[0_0_10px_rgba(255,0,0,0.8)]"></div>
              <p className="absolute -bottom-10 left-0 right-0 text-center text-white/80 text-sm font-medium drop-shadow-md">
                Houd barcode stabiel in beeld
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsScanning(false)}
            className="absolute top-4 right-4 bg-gray-800/50 p-3 rounded-full text-white backdrop-blur-md z-30 hover:bg-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-gray-900 p-4 z-30 text-center border-t border-gray-800">
          <p className="text-gray-500 text-xs mb-2">Lukt het scannen niet?</p>
          <button onClick={handleSimulatedScan} className="text-blue-400 text-sm hover:underline font-medium">
            Gebruik test data
          </button>
        </div>
      </div>
    );
  };

  const ImageFallback = ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => {
    const [imgError, setImgError] = useState(false);

    if (!src || src.includes("dummy") || imgError) {
      return (
        <div className={`bg-gray-700 flex items-center justify-center text-gray-500 ${className}`}>
          <Disc size={32} />
        </div>
      );
    }
    return <img src={src} alt={alt} className={className} onError={() => setImgError(true)} />;
  };

  const Modal = () => {
    if (!selectedRelease) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-gray-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-gray-700">
          <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-bold truncate pr-4">{selectedRelease.title}</h2>
            <button onClick={() => setSelectedRelease(null)} className="p-2 hover:bg-gray-700 rounded-full">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/3 flex-shrink-0">
                <ImageFallback
                  src={selectedRelease.images?.[0]?.uri || selectedRelease.thumb}
                  alt={selectedRelease.title}
                  className="w-full aspect-square object-cover rounded-lg shadow-lg"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="text-gray-400 text-sm">Artiest</div>
                <div className="text-lg font-medium">{selectedRelease.artists?.map((a) => a.name).join(", ") || "Onbekend"}</div>
                <div className="text-gray-400 text-sm">Jaar</div>
                <div>{selectedRelease.year || selectedRelease.released || "Onbekend"}</div>
                <div className="text-gray-400 text-sm">Genres</div>
                <div className="flex flex-wrap gap-2">
                  {selectedRelease.genres?.map((g) => (
                    <span key={g} className="px-2 py-1 bg-blue-900/50 text-blue-200 text-xs rounded-full border border-blue-800">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => addToCollection(selectedRelease)}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Toevoegen aan Collectie
            </button>
          </div>
        </div>
      </div>
    );
  };

  const PaginationControls = ({ current, total, onPageChange }: { current: number; total: number; onPageChange: (p: number) => void }) => {
    if (total <= 1) return null;
    return (
      <div className="flex justify-center items-center gap-4 mt-8 py-4 border-t border-gray-800">
        <button
          onClick={() => onPageChange(current - 1)}
          disabled={current === 1}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <ChevronLeft size={16} /> Vorige
        </button>
        <span className="text-sm text-gray-400">
          Pagina <span className="text-white font-bold">{current}</span> van {total}
        </span>
        <button
          onClick={() => onPageChange(current + 1)}
          disabled={current === total}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          Volgende <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      {/* Full Screen Scanner Overlay */}
      <ScannerModal />

      <header className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              <Disc className="text-blue-400" /> Vinyl Scout
            </h1>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {!apiToken && !isDemoMode ? (
                <div className="flex gap-2 w-full">
                  <input
                    type="text"
                    placeholder="Plak Discogs API Token..."
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-sm rounded px-3 py-2 w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => setIsDemoMode(true)}
                    className="whitespace-nowrap px-3 py-2 text-xs bg-gray-800 border border-gray-600 hover:bg-gray-700 rounded text-gray-300"
                  >
                    Demo
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-3 py-1.5 rounded-full border border-green-900">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  {isDemoMode ? "Demo Modus" : "API Verbonden"}
                  <button
                    onClick={() => {
                      setApiToken("");
                      setIsDemoMode(false);
                    }}
                    className="ml-2 hover:text-white underline"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-6 text-sm font-medium border-b border-gray-800 pt-2">
            <button
              onClick={() => setActiveTab("search")}
              className={`pb-3 px-2 border-b-2 transition-colors ${
                activeTab === "search" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              Zoeken
            </button>
            <button
              onClick={() => setActiveTab("collection")}
              className={`pb-3 px-2 border-b-2 transition-colors ${
                activeTab === "collection" ? "border-purple-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              Mijn Collectie <span className="ml-1 bg-gray-800 text-xs px-2 py-0.5 rounded-full">{collection.length}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {activeTab === "search" && (
          <div className="space-y-6">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                {searchType === "barcode" ? (
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                )}
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchType === "barcode" ? "Typ barcode of scan..." : "Zoek artiest, album..."}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-12 py-3 focus:ring-2 focus:ring-blue-600 outline-none text-white placeholder-gray-500 transition-all"
                />

                <button
                  type="button"
                  onClick={() => setIsScanning(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
                  title="Open Camera Scanner"
                >
                  <Camera size={20} />
                </button>
              </div>

              <div className="flex gap-2">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="q">Tekst</option>
                  <option value="barcode">Barcode</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Zoek"}
                </button>
              </div>
            </form>

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 rounded-lg text-sm flex items-center gap-2">
                <Info size={16} /> {error}
              </div>
            )}

            <div className="flex justify-between items-end pb-2 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-gray-300">{query ? `Resultaten voor "${query}"` : "Trending / Nieuw"}</h2>
              <span className="text-xs text-gray-500">{searchPagination.items} items gevonden</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => fetchDetails(item.id, item.resource_url)}
                  className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/20 transition-all cursor-pointer flex flex-col"
                >
                  <div className="aspect-square bg-gray-800 relative overflow-hidden">
                    <ImageFallback
                      src={item.thumb || item.cover_image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded">Details</span>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-medium text-gray-200 line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors">{item.title}</h3>
                    <div className="mt-auto text-xs text-gray-500 flex justify-between items-center">
                      <span>{item.year || "N/A"}</span>
                      <span className="truncate max-w-[50%]">{item.label?.[0]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <PaginationControls current={searchPagination.page} total={searchPagination.pages} onPageChange={handlePageChange} />
          </div>
        )}

        {activeTab === "collection" && (
          <div>
            {collection.length === 0 ? (
              <div className="text-center py-20 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                <Music size={48} className="mx-auto mb-4 opacity-20" />
                <p>Je collectie is nog leeg.</p>
                <button onClick={() => setActiveTab("search")} className="text-blue-400 text-sm mt-2 hover:underline">
                  Ga naar zoeken
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                  <h2 className="text-lg font-semibold text-gray-300">Mijn Albums</h2>
                  <span className="text-xs text-gray-500">{collection.length} totaal</span>
                </div>

                {paginatedCollection.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-center group hover:border-gray-700 transition-colors"
                  >
                    <div className="w-16 h-16 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                      <ImageFallback src={item.thumb || item.cover_image} alt={item.title} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-200 truncate">{item.title}</h3>
                      <div className="text-sm text-gray-500 flex flex-wrap gap-x-4">
                        <span>{item.year}</span>
                        <span>{item.catno || item.label?.[0] || "Geen label"}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => removeFromCollection(item.id)}
                        className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Verwijderen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                <PaginationControls current={collectionPage} total={collectionTotalPages} onPageChange={setCollectionPage} />
              </div>
            )}
          </div>
        )}
      </main>

      <Modal />
    </div>
  );
}

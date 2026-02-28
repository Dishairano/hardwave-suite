'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardNav } from '@/components/DashboardNav';

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  version: string;
  downloads: {
    windows: string | null;
    mac: string | null;
    linux: string | null;
  };
  fileSize: number;
  changelog: string | null;
}

interface RecentDownload {
  product: string;
  version: string;
  platform: string;
  downloadedAt: string;
}

export default function DownloadsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [recentDownloads, setRecentDownloads] = useState<RecentDownload[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userStr));
    loadDownloads(token);
  }, [router]);

  const loadDownloads = async (token: string) => {
    try {
      const response = await fetch('/api/downloads', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setHasAccess(data.hasAccess);
        setProducts(data.products);
        setRecentDownloads(data.recentDownloads || []);
      }
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (product: Product, platform: 'windows' | 'mac' | 'linux') => {
    const downloadUrl = product.downloads[platform];
    if (!downloadUrl) {
      alert(`${platform.charAt(0).toUpperCase() + platform.slice(1)} version not available yet.`);
      return;
    }

    // Record download
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/downloads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productSlug: product.slug,
          platform,
        }),
      });
    } catch (error) {
      console.error('Failed to record download:', error);
    }

    // Start download
    window.location.href = downloadUrl;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'windows': return '&#128187;';
      case 'mac': return '&#63743;';
      case 'linux': return '&#128039;';
      default: return '&#128190;';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950">
      <DashboardNav user={user} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Downloads</h1>
          <p className="text-slate-400">Download Hardwave software for your platform</p>
        </div>

        {!hasAccess ? (
          <Card className="bg-slate-900/50 border-purple-500/20">
            <CardContent className="py-12 text-center">
              <div className="text-6xl mb-4">&#128274;</div>
              <p className="text-lg text-slate-300 mb-2">Active subscription required</p>
              <p className="text-slate-500 mb-6">Subscribe to Hardwave Pro to access all downloads.</p>
              <Button
                onClick={() => router.push('/dashboard/subscription')}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                View Subscription Options
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Products */}
            <div className="space-y-6 mb-8">
              {products.map((product) => (
                <Card key={product.id} className="bg-slate-900/50 border-purple-500/20">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white text-xl">{product.name}</CardTitle>
                        <CardDescription className="text-slate-400">
                          {product.description}
                        </CardDescription>
                      </div>
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        v{product.version}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => handleDownload(product, 'windows')}
                        disabled={!product.downloads.windows}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#128187; ' }} />
                        Windows
                        {product.fileSize && (
                          <span className="ml-2 opacity-70">({product.fileSize} MB)</span>
                        )}
                      </Button>

                      <Button
                        onClick={() => handleDownload(product, 'mac')}
                        disabled={!product.downloads.mac}
                        variant="outline"
                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50"
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#63743; ' }} />
                        macOS
                        {!product.downloads.mac && (
                          <span className="ml-2 opacity-70">(Coming Soon)</span>
                        )}
                      </Button>

                      <Button
                        onClick={() => handleDownload(product, 'linux')}
                        disabled={!product.downloads.linux}
                        variant="outline"
                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50"
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#128039; ' }} />
                        Linux
                        {!product.downloads.linux && (
                          <span className="ml-2 opacity-70">(Coming Soon)</span>
                        )}
                      </Button>
                    </div>

                    {product.changelog && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <p className="text-sm text-slate-400 mb-2">Changelog:</p>
                        <p className="text-sm text-slate-500 whitespace-pre-wrap">{product.changelog}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {products.length === 0 && (
                <Card className="bg-slate-900/50 border-purple-500/20">
                  <CardContent className="py-12 text-center">
                    <div className="text-6xl mb-4">&#128230;</div>
                    <p className="text-lg text-slate-300">No products available yet</p>
                    <p className="text-slate-500">Check back soon for new releases.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent Downloads */}
            {recentDownloads.length > 0 && (
              <Card className="bg-slate-900/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white">Recent Downloads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentDownloads.map((download, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="text-xl"
                            dangerouslySetInnerHTML={{ __html: getPlatformIcon(download.platform) }}
                          />
                          <div>
                            <p className="text-white">{download.product}</p>
                            <p className="text-sm text-slate-500">v{download.version}</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-400">{formatDate(download.downloadedAt)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

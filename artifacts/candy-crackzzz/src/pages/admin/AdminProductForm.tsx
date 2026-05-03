import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft, Save } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ImageUpload from '@/components/ui/ImageUpload';
import SmartDescriptionButton from '@/components/admin/SmartDescriptionButton';
import { generateProductDescription, generateShortProductDescription } from '@/lib/smartDescription';
import { Product, ProductCategory } from '@/types';

const defaultProduct: Omit<Product, 'id' | 'createdAt'> = {
  name: '',
  slug: '',
  category: 'candy-grapes',
  description: '',
  shortDescription: '',
  price: 0,
  imageUrl: '',
  flavorNotes: '',
  colorThemeNotes: '',
  isAvailable: true,
  isFeatured: false,
  isSeasonal: false,
  isCustomEligible: false,
  isSoldOut: false,
  isVisible: true
};

export default function AdminProductForm() {
  const [, newParams] = useRoute('/admin/products/new');
  const [, editParams] = useRoute('/admin/products/:id/edit');
  const isEdit = !!editParams;
  const productId = editParams?.id;
  const [, setLocation] = useLocation();

  const { products, setProducts } = useAppContext();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'createdAt'>>(defaultProduct);
  const [priceType, setPriceType] = useState<'fixed' | 'custom'>('fixed');

  useEffect(() => {
    if (isEdit && productId) {
      const product = products.find(p => p.id === productId);
      if (product) {
        setFormData(product);
        setPriceType(product.price === null ? 'custom' : 'fixed');
      } else {
        setLocation('/admin/products');
      }
    }
  }, [isEdit, productId, products]);

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'name' && !isEdit) {
        updated.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
      return updated;
    });
  };

  const handlePriceTypeChange = (type: 'fixed' | 'custom') => {
    setPriceType(type);
    if (type === 'custom') {
      handleChange('price', null);
    } else {
      handleChange('price', 0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEdit && productId) {
      setProducts(prev => prev.map(p => p.id === productId ? { ...formData, id: p.id, createdAt: p.createdAt } : p));
      toast({ title: "Product updated", description: "Changes saved successfully." });
    } else {
      const newProduct: Product = {
        ...formData,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString()
      };
      setProducts(prev => [newProduct, ...prev]);
      toast({ title: "Product created", description: `${newProduct.name} has been added.` });
    }
    
    setLocation('/admin/products');
  };

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/admin/products')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
            <h2 className="text-xl font-black uppercase tracking-wider mb-4 border-b border-border pb-2">Basic Info</h2>
            
            <div className="space-y-2">
              <Label className="font-bold">Product Name</Label>
              <Input 
                required 
                value={formData.name} 
                onChange={e => handleChange('name', e.target.value)} 
                className="bg-background font-bold text-lg h-12"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-bold">Category</Label>
                <Select value={formData.category} onValueChange={(val) => handleChange('category', val)}>
                  <SelectTrigger className="bg-background font-bold h-12">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="candy-grapes">Candy Grapes</SelectItem>
                    <SelectItem value="candy-pineapple">Candy Pineapple</SelectItem>
                    <SelectItem value="party-trays">Party Trays</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Pricing</Label>
                <div className="flex gap-2 mb-2">
                  <Button type="button" size="sm" variant={priceType === 'fixed' ? 'default' : 'outline'} onClick={() => handlePriceTypeChange('fixed')} className="flex-1 font-bold uppercase text-xs">Fixed</Button>
                  <Button type="button" size="sm" variant={priceType === 'custom' ? 'default' : 'outline'} onClick={() => handlePriceTypeChange('custom')} className="flex-1 font-bold uppercase text-xs">Custom Quote</Button>
                </div>
                {priceType === 'fixed' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <Input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={formData.price || ''} 
                      onChange={e => handleChange('price', parseFloat(e.target.value))} 
                      className="bg-background font-bold pl-8 h-12"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-bold">Short Description (Card View)</Label>
                <SmartDescriptionButton
                  generate={() => generateShortProductDescription(formData)}
                  onApply={text => handleChange('shortDescription', text.slice(0, 100))}
                  disabled={!formData.name}
                  label="Generate Smart Description"
                  testId="smart-desc-product-short"
                />
              </div>
              <Input 
                required 
                maxLength={100}
                value={formData.shortDescription} 
                onChange={e => handleChange('shortDescription', e.target.value)} 
                className="bg-background font-medium"
              />
              <p className="text-xs text-muted-foreground text-right">{formData.shortDescription.length}/100</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-bold">Full Description (Detail View)</Label>
                <SmartDescriptionButton
                  generate={() => generateProductDescription(formData)}
                  onApply={text => handleChange('description', text)}
                  disabled={!formData.name}
                  label="Generate Smart Description"
                  testId="smart-desc-product-full"
                />
              </div>
              <Textarea 
                required 
                value={formData.description} 
                onChange={e => handleChange('description', e.target.value)} 
                className="bg-background min-h-[150px] font-medium resize-none"
              />
            </div>
          </div>

          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
            <h2 className="text-xl font-black uppercase tracking-wider mb-4 border-b border-border pb-2">Product Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-bold">Flavor Notes</Label>
                <Input 
                  value={formData.flavorNotes} 
                  onChange={e => handleChange('flavorNotes', e.target.value)} 
                  placeholder="e.g. Mixed Fruit, Sour Apple"
                  className="bg-background font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Color/Theme</Label>
                <Input 
                  value={formData.colorThemeNotes} 
                  onChange={e => handleChange('colorThemeNotes', e.target.value)} 
                  placeholder="e.g. Rainbow, Pink & Blue"
                  className="bg-background font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-black uppercase tracking-wider mb-4 border-b border-border pb-2">Product Image</h2>
            <ImageUpload 
              value={formData.imageUrl} 
              onChange={(url) => handleChange('imageUrl', url)} 
              className="w-full"
            />
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-6">
            <h2 className="text-xl font-black uppercase tracking-wider mb-4 border-b border-border pb-2">Status & Badges</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-bold text-base">Visible in Store</Label>
                  <p className="text-xs text-muted-foreground">Hide product without deleting</p>
                </div>
                <Switch checked={formData.isVisible} onCheckedChange={(v) => handleChange('isVisible', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-bold text-base text-destructive">Mark Sold Out</Label>
                  <p className="text-xs text-muted-foreground">Prevent ordering</p>
                </div>
                <Switch checked={formData.isSoldOut} onCheckedChange={(v) => handleChange('isSoldOut', v)} />
              </div>
              <div className="w-full h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-bold text-base text-secondary">Featured</Label>
                  <p className="text-xs text-muted-foreground">Show on homepage</p>
                </div>
                <Switch checked={formData.isFeatured} onCheckedChange={(v) => handleChange('isFeatured', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-bold text-base text-accent">Seasonal</Label>
                  <p className="text-xs text-muted-foreground">Add seasonal badge</p>
                </div>
                <Switch checked={formData.isSeasonal} onCheckedChange={(v) => handleChange('isSeasonal', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-bold text-base text-primary">Customizable</Label>
                  <p className="text-xs text-muted-foreground">Show theme inputs on product page</p>
                </div>
                <Switch checked={formData.isCustomEligible} onCheckedChange={(v) => handleChange('isCustomEligible', v)} />
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full h-16 text-xl font-black uppercase tracking-wider shadow-[0_0_20px_rgba(255,0,255,0.4)]">
            <Save className="w-5 h-5 mr-2" /> Save Product
          </Button>
        </div>

      </form>
    </AdminLayout>
  );
}

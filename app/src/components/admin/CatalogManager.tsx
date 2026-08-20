import { useState } from 'react'
import { Search, Edit3, Trash2, X } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'

interface Product {
  _id: string
  name: string
  category: string
  description: string
  image: string
  featured: boolean
}

interface Category {
  id: string
  name: string
}

interface CatalogManagerProps {
  canManage: boolean
  products: Product[]
  categories: Category[]
  onAddProduct: () => void
  onEditProduct: (product: Product) => void
  onDeleteProduct: (id: string) => void
  onSaveCategory: (category: { name: string, id: string }, editId: string | null) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
}

export default function CatalogManager({
  canManage,
  products,
  categories,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onSaveCategory,
  onDeleteCategory
}: CatalogManagerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', id: '' })

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-warm-stone/20 p-4 rounded-md border border-charcoal/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" size={14} />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-charcoal/10 rounded-md text-[13px] outline-none focus:border-charcoal transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 bg-white border border-charcoal/10 rounded-md text-[11px] font-bold uppercase tracking-wider outline-none"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {canManage && <><button onClick={() => setShowCategoryModal(true)} className="px-4 py-2 border border-charcoal/10 rounded-md text-[11px] font-bold uppercase tracking-wider hover:bg-warm-stone transition-all">Manage Categories</button>
          <button onClick={onAddProduct} className="px-4 py-2 bg-charcoal text-white rounded-md text-[11px] font-bold uppercase tracking-wider hover:bg-black transition-all">New Product</button></>}
        </div>
      </div>

      <div className="bg-white border border-charcoal/10 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-warm-stone/30 border-b border-charcoal/5">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Product</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Category</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-charcoal/40 text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-charcoal/40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal/5">
            {filteredProducts.map((p) => (
              <tr key={p._id} className="group hover:bg-warm-stone/10">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <img src={resolveMediaUrl(p.image)} className="w-10 h-10 rounded border border-charcoal/5 object-cover grayscale opacity-80" alt="" />
                    <span className="font-medium text-charcoal">{p.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-charcoal/60 uppercase text-[10px] font-bold tracking-tight">
                    {categories.find(c => c.id === p.category)?.name || p.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {p.featured && <span className="text-[9px] font-bold uppercase text-brass border border-brass/20 px-2 py-0.5 rounded">Featured</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  {canManage && <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditProduct(p)} className="p-2 hover:text-blue-600"><Edit3 size={14}/></button>
                    <button onClick={() => onDeleteProduct(p._id)} className="p-2 hover:text-red-600"><Trash2 size={14}/></button>
                  </div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && showCategoryModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
          <div className="relative w-full max-w-lg bg-white p-8 rounded-md shadow-2xl border border-charcoal/10">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-charcoal">Categories</h3>
                <button onClick={() => setShowCategoryModal(false)}><X size={20} className="text-charcoal/20 hover:text-charcoal"/></button>
             </div>
             <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto pr-2">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 border border-charcoal/5 rounded bg-warm-stone/10">
                     <span className="text-[13px] font-medium">{c.name} <span className="text-[10px] text-charcoal/30 ml-2">({c.id})</span></span>
                     <button onClick={() => onDeleteCategory(c.id)} className="p-1.5 text-red-300 hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                ))}
             </div>
             <form onSubmit={async (e) => { e.preventDefault(); await onSaveCategory(categoryForm, null); setCategoryForm({name:'', id:''}); }} className="flex gap-2 pt-4 border-t border-charcoal/5">
                <input type="text" placeholder="New Category Name" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} className="flex-1 px-3 py-2 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none" required />
                <button type="submit" className="px-4 py-2 bg-charcoal text-white rounded-md text-[11px] font-bold uppercase tracking-wider hover:bg-black">Add</button>
             </form>
          </div>
        </div>
      )}
    </div>
  )
}

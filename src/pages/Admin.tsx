import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Settings, Package, Tag, Users, Plus, Pencil, Trash2, X, Save,
  ToggleLeft, ToggleRight, Eye, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, cn } from '../lib/utils'
import type { Database } from '../lib/supabase'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

type Tab = 'products' | 'categories' | 'users'

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  caixa: 'Caixa',
  cozinha: 'Cozinha',
  atendente: 'Atendente',
  cliente: 'Cliente',
}

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  caixa: 'bg-emerald-100 text-emerald-800',
  cozinha: 'bg-blue-100 text-blue-800',
  atendente: 'bg-amber-100 text-amber-800',
  cliente: 'bg-slate-100 text-slate-800',
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const { signUp } = useAuth()
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', name: '' })
  const [userScreens, setUserScreens] = useState<string[]>(['menu'])
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['atendente'])

  // Product modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', category_id: '', image_url: '', available: true
  })

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', icon_svg: '', active: true })

  // User role modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editingRoles, setEditingRoles] = useState<string[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [productsRes, categoriesRes, profilesRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('profiles').select('*').order('name'),
      ])

      if (productsRes.data) setProducts(productsRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
      if (profilesRes.data) setProfiles(profilesRes.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // ===== PRODUCTS =====
  function openProductModal(product?: Product) {
    if (product) {
      setEditingProduct(product)
      setProductForm({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        category_id: product.category_id,
        image_url: product.image_url,
        available: product.available,
      })
    } else {
      setEditingProduct(null)
      setProductForm({ name: '', description: '', price: '', category_id: categories[0]?.id || '', image_url: '', available: true })
    }
    setIsProductModalOpen(true)
  }

  async function saveProduct() {
    if (!productForm.name.trim() || !productForm.price) {
      toast.error('Preencha nome e preço')
      return
    }

    try {
      const data = {
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        category_id: productForm.category_id,
        image_url: productForm.image_url,
        available: productForm.available,
      }

      if (editingProduct) {
        const { error } = await supabase.from('products').update(data).eq('id', editingProduct.id)
        if (error) throw error
        toast.success('Produto atualizado!')
      } else {
        const { error } = await supabase.from('products').insert(data)
        if (error) throw error
        toast.success('Produto criado!')
      }

      setIsProductModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error('Erro ao salvar produto')
      console.error(error)
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Excluir este produto?')) return
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      toast.success('Produto excluído!')
      fetchData()
    } catch (error) {
      toast.error('Erro ao excluir produto')
    }
  }

  async function toggleProductAvailability(product: Product) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ available: !product.available })
        .eq('id', product.id)
      if (error) throw error
      fetchData()
    } catch (error) {
      toast.error('Erro ao atualizar')
    }
  }

  // ===== CATEGORIES =====
  function openCategoryModal(category?: Category) {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({ name: category.name, icon_svg: category.icon_svg, active: category.active })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', icon_svg: '', active: true })
    }
    setIsCategoryModalOpen(true)
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) {
      toast.error('Informe o nome da categoria')
      return
    }

    try {
      if (editingCategory) {
        const { error } = await supabase.from('categories').update(categoryForm).eq('id', editingCategory.id)
        if (error) throw error
        toast.success('Categoria atualizada!')
      } else {
        const { error } = await supabase.from('categories').insert(categoryForm)
        if (error) throw error
        toast.success('Categoria criada!')
      }
      setIsCategoryModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error('Erro ao salvar categoria')
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      toast.success('Categoria excluída!')
      fetchData()
    } catch (error) {
      toast.error('Erro ao excluir categoria')
    }
  }

  // ===== USERS =====
  function effectiveRoles(profile: Profile): string[] {
    const list = [...(profile.roles || []), profile.role].filter(Boolean)
    return Array.from(new Set(list))
  }

  function toggleRole(list: string[], role: string) {
    return list.includes(role) ? list.filter((r) => r !== role) : [...list, role]
  }

  function openRoleModal(profile: Profile) {
    setEditingProfile(profile)
    setEditingRoles(effectiveRoles(profile))
    setIsRoleModalOpen(true)
  }

  async function saveUserRoles() {
    if (!editingProfile) return
    if (editingRoles.length === 0) {
      toast.error('Selecione ao menos uma função')
      return
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ roles: editingRoles, role: editingRoles[0] as Profile['role'] })
        .eq('id', editingProfile.id)
      if (error) throw error
      toast.success('Funções atualizadas!')
      setIsRoleModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error('Erro ao atualizar funções')
    }
  }

  const screenOptions = [
    { key: 'admin', label: 'Painel administrativo' },
    { key: 'orders', label: 'Pedidos' },
    { key: 'kitchen', label: 'Cozinha' },
    { key: 'cashier', label: 'Caixa' },
    { key: 'menu', label: 'Cardápio' },
  ]

  async function createUser() {
    const name = userForm.name.trim()
    const email = userForm.email.trim()

    if (!name) {
      toast.error('Informe o nome do usuário')
      return
    }
    if (!email || !email.includes('@')) {
      toast.error('Informe um email válido')
      return
    }
    if (userForm.password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres')
      return
    }
    const screens = userScreens.length > 0 ? userScreens : ['menu']
    const roles = newUserRoles.length > 0 ? newUserRoles : ['cliente']

    const { error } = await signUp(email, userForm.password, name, 'cliente')
    if (error) {
      toast.error(error)
      return
    }

    // O trigger cria o perfil; esta atualização define funções e telas.
    const { data: created } = await supabase
      .from('profiles')
      .select('id')
      .eq('name', name)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!created?.id) {
      toast.error('Usuário criado, mas perfil não localizado')
      return
    }

    const { error: permissionError } = await supabase
      .from('profiles')
      .update({ roles, role: roles[0] as Profile['role'], allowed_screens: screens })
      .eq('id', created.id)

    if (permissionError) {
      toast.error('Usuário criado, mas não foi possível salvar as permissões')
      return
    }

    toast.success('Usuário criado com permissões definidas')
    setIsUserModalOpen(false)
    setUserForm({ email: '', password: '', name: '' })
    setUserScreens(['menu'])
    setNewUserRoles(['atendente'])
    fetchData()
  }

  const tabs = [
    { key: 'products', label: 'Produtos', icon: <Package className="w-4 h-4" /> },
    { key: 'categories', label: 'Categorias', icon: <Tag className="w-4 h-4" /> },
    { key: 'users', label: 'Usuários', icon: <Users className="w-4 h-4" /> },
  ] as const

  if (loading) {
    return (
      <Layout title="Administração">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Administração">
      {/* Atalhos principais */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Acesso rápido</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: '/orders', label: 'Pedidos', description: 'Criar e acompanhar pedidos', icon: <Package className="w-5 h-5" />, color: 'bg-amber-500' },
            { to: '/kitchen', label: 'Cozinha', description: 'Acompanhar preparo', icon: <Settings className="w-5 h-5" />, color: 'bg-blue-500' },
            { to: '/cashier', label: 'Caixa', description: 'Pagamentos e faturamento', icon: <Users className="w-5 h-5" />, color: 'bg-emerald-500' },
            { to: '/menu', label: 'Cardápio', description: 'Visualizar cardápio público', icon: <Tag className="w-5 h-5" />, color: 'bg-purple-500' },
          ].map((shortcut) => (
            <Link
              key={shortcut.to}
              to={shortcut.to}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
            >
              <div className={`w-10 h-10 ${shortcut.color} text-white rounded-xl flex items-center justify-center mb-3`}>
                {shortcut.icon}
              </div>
              <p className="font-semibold text-slate-900">{shortcut.label}</p>
              <p className="text-xs text-slate-500 mt-1">{shortcut.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
              activeTab === tab.key
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Produtos ({products.length})</h2>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => openProductModal()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo Produto
            </motion.button>
          </div>

          <div className="grid gap-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4"
              >
                <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🍔</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{product.name}</h3>
                  <p className="text-sm text-amber-600 font-bold">{formatCurrency(product.price)}</p>
                  <p className="text-xs text-slate-500 truncate">{product.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleProductAvailability(product)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      product.available ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                    )}
                    title={product.available ? 'Disponível' : 'Indisponível'}
                  >
                    {product.available ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => openProductModal(product)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="p-2 hover:bg-crimson-50 rounded-lg text-crimson-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Categorias ({categories.length})</h2>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => openCategoryModal()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Nova Categoria
            </motion.button>
          </div>

          <div className="grid gap-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl" dangerouslySetInnerHTML={{ __html: category.icon_svg || '📂' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{category.name}</h3>
                  <p className="text-xs text-slate-500">{category.active ? 'Ativa' : 'Inativa'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openCategoryModal(category)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteCategory(category.id)}
                    className="p-2 hover:bg-crimson-50 rounded-lg text-crimson-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Usuários ({profiles.length})</h2>
            <button onClick={() => setIsUserModalOpen(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> Novo usuário
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold">
                          {profile.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{profile.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {effectiveRoles(profile).map((r) => (
                          <span key={r} className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium', roleColors[r])}>
                            {roleLabels[r]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-500 mb-1">{profile.allowed_screens?.join(', ') || 'menu'}</p>
                      <button
                        onClick={() => openRoleModal(profile)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
                      >
                        Alterar Permissão
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              placeholder="Nome do produto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 resize-none"
              rows={2}
              placeholder="Descrição do produto"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$) *</label>
              <input
                type="number"
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <select
                value={productForm.category_id}
                onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL da Imagem</label>
            <input
              type="text"
              value={productForm.image_url}
              onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProductForm({ ...productForm, available: !productForm.available })}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                productForm.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              )}
            >
              {productForm.available ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {productForm.available ? 'Disponível' : 'Indisponível'}
            </button>
          </div>
          <button
            onClick={saveProduct}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingProduct ? 'Salvar Alterações' : 'Criar Produto'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Novo usuário">
        <div className="space-y-4">
          <input placeholder="Nome" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
          <input type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
          <input type="password" placeholder="Senha (mínimo 6 caracteres)" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Funções (pode marcar várias)</p>
            <div className="space-y-2">
              {Object.entries(roleLabels).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={newUserRoles.includes(key)} onChange={() => setNewUserRoles(toggleRole(newUserRoles, key))} className="accent-amber-500" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Telas permitidas</p>
            <div className="space-y-2">
              {screenOptions.map((screen) => (
                <label key={screen.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={userScreens.includes(screen.key)} onChange={(e) => setUserScreens(e.target.checked ? [...userScreens, screen.key] : userScreens.filter((key) => key !== screen.key))} className="accent-amber-500" />
                  {screen.label}
                </label>
              ))}
            </div>
          </div>
          <button onClick={createUser} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">Criar usuário</button>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              placeholder="Nome da categoria"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ícone SVG (opcional)</label>
            <textarea
              value={categoryForm.icon_svg}
              onChange={(e) => setCategoryForm({ ...categoryForm, icon_svg: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 resize-none font-mono text-xs"
              rows={3}
              placeholder="<svg>...</svg>"
            />
          </div>
          <button
            onClick={saveCategory}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
          </button>
        </div>
      </Modal>

      {/* Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Funções do usuário"
      >
        {editingProfile && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Selecione as funções de <strong>{editingProfile.name}</strong> (pode marcar várias):
            </p>
            {Object.entries(roleLabels).map(([key, label]) => {
              const checked = editingRoles.includes(key)
              return (
                <label
                  key={key}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 font-medium transition-all',
                    checked
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setEditingRoles(toggleRole(editingRoles, key))}
                    className="h-4 w-4 accent-white"
                  />
                  <span className="flex-1">{label}</span>
                  {editingProfile.role === key && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', checked ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>Principal</span>
                  )}
                </label>
              )
            })}
            <button
              onClick={saveUserRoles}
              disabled={editingRoles.length === 0}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar funções
            </button>
          </div>
        )}
      </Modal>
    </Layout>
  )
}

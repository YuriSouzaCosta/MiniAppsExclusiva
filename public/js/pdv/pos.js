// Products will be loaded from server
let PRODUCTS = [];

// State
let currentStep = 1;
let cart = [];
let selectedPaymentMethod = '';
let currentModalProduct = null;
let editingCartIndex = -1; // -1 means adding new, >= 0 means editing
let allBrands = [];
let selectedBrand = '';
let currentNunota = null;

// DOM Elements
const progressBar = document.getElementById('progressBar');
const productGrid = document.getElementById('productGrid');
const productSearch = document.getElementById('productSearch');
const itemModal = document.getElementById('itemModal');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // renderProducts(PRODUCTS); // Don't render initially
    fetchBrands();
    updateUI();

    // Check for NUNOTA in URL (Editing Mode)
    const urlParams = new URLSearchParams(window.location.search);
    const nunotaParam = urlParams.get('nunota');

    if (nunotaParam) {
        await loadOrderForEditing(nunotaParam);
    }
});

async function loadOrderForEditing(nunota) {
    try {
        Swal.fire({
            title: 'Carregando Pedido...',
            text: 'Aguarde enquanto buscamos os dados.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(`/pdv/order-details?nunota=${nunota}`);
        const result = await response.json();

        if (result.success) {
            const order = result.order;

            // 1. Set Header Data
            currentNunota = order.nunota;

            // Client
            document.getElementById('clientName').value = order.clientName;
            document.getElementById('selectedCodparc').value = order.codparc;

            // Payment
            selectedPaymentMethod = 'loaded'; // Just a flag, specific method logic might need adjustment if visual selection is strict
            document.getElementById('selectedCodtipvenda').value = order.codtipvenda;

            // Update Payment UI (Try to match known types or generic)
            // This is a simplification; ideally we'd map the code back to 'avista', 'cartao', etc. if possible
            // For now, we just ensure the hidden field is set and maybe show the name
            const paymentLabel = order.paymentMethodName || 'Selecionado';

            // 2. Set Items
            cart = order.items.map(item => ({
                ...item,
                price: Number(item.price),
                quantity: Number(item.quantity),
                discount: Number(item.discount)
            }));

            // 3. Update UI
            renderStep2Cart();
            renderCartSummary();
            updateMobileCartBadge();

            // Go to Step 2
            goToStep(2);

            Swal.close();

            // Optional: Notify user
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: `Pedido #${nunota} carregado para edição`
            });

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: result.message || 'Não foi possível carregar o pedido.'
            });
        }
    } catch (error) {
        console.error('Error loading order:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Erro de conexão ao carregar pedido.'
        });
    }
}

// Navigation
function goToStep(step) {
    if (step < 1 || step > 3) return;
    currentStep = step;
    updateUI();
}

async function nextStep() {
    if (currentStep === 1) {
        const success = await checkAndCreateHeader();
        if (!success) return; // Don't proceed if header creation failed
    }
    goToStep(currentStep + 1);
}

function prevStep() {
    goToStep(currentStep - 1);
}

function updateUI() {
    // Update Progress Bar
    const progress = ((currentStep - 1) / 2) * 100;
    progressBar.style.width = `${progress}%`;

    // Update Indicators - Mobile Enhanced
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`step${i}Indicator`);
        const label = indicator.nextElementSibling;

        if (i === currentStep) {
            indicator.className = "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 border-green-600 bg-white text-green-600 transition-all shadow-sm";
            label.className = "text-[11px] md:text-xs font-semibold mt-2 text-green-700";
        } else if (i < currentStep) {
            indicator.className = "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 border-green-600 bg-green-600 text-white transition-all shadow-sm";
            indicator.innerHTML = '<i data-lucide="check" class="w-5 h-5 md:w-6 md:h-6"></i>';
            label.className = "text-[11px] md:text-xs font-semibold mt-2 text-gray-500";
        } else {
            indicator.className = "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 border-gray-300 bg-white text-gray-400 transition-all shadow-sm";
            indicator.innerHTML = `<span class="font-bold text-base md:text-lg">${i}</span>`;
            label.className = "text-[11px] md:text-xs font-semibold mt-2 text-gray-500";
        }
    }
    lucide.createIcons();

    // Show/Hide Steps
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step${currentStep}`).classList.remove('hidden');

    // Update Buttons - Desktop
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.disabled = currentStep === 1;
    if (nextBtn) nextBtn.style.display = currentStep === 3 ? 'none' : 'inline-flex';

    // Update Buttons - Mobile
    const prevBtnMobile = document.getElementById('prevBtnMobile');
    const nextBtnMobile = document.getElementById('nextBtnMobile');
    if (prevBtnMobile) prevBtnMobile.disabled = currentStep === 1;
    if (nextBtnMobile) nextBtnMobile.style.display = currentStep === 3 ? 'none' : 'inline-flex';

    // Show/Hide Mobile Nav Footer based on step
    const mobileNavFooter = document.getElementById('mobileNavFooter');
    const floatingCartContainer = document.getElementById('floatingCartContainer');

    if (mobileNavFooter) {
        // Show nav footer on step 1 and step 2, hide on step 3 (has its own finalize button)
        mobileNavFooter.style.display = currentStep === 3 ? 'none' : 'flex';
    }

    if (floatingCartContainer) {
        // Show floating cart only on step 2
        floatingCartContainer.style.display = currentStep === 2 ? 'block' : 'none';
    }

    // Refresh Summary if on step 2 or 3
    if (currentStep === 2) {
        renderStep2Cart();
        updateMobileCartBadge();
    } else if (currentStep === 3) {
        renderCartSummary();
    }
}

// Update mobile cart badge
function updateMobileCartBadge() {
    const badge = document.getElementById('mobileCartBadge');
    const total = document.getElementById('mobileCartTotal');
    const btn = document.getElementById('floatingCartBtn');

    if (badge && total) {
        const itemCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const totalValue = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0), 0);

        badge.textContent = itemCount;
        total.textContent = `R$ ${totalValue.toFixed(2)}`;

        // Add pulse animation when has items
        if (btn) {
            if (itemCount > 0) {
                btn.classList.add('has-items');
            } else {
                btn.classList.remove('has-items');
            }
        }
    }
}

// Step 1: Identification
const clientNameInput = document.getElementById('clientName');
const partnerResults = document.getElementById('partnerSearchResults');
const selectedCodparcInput = document.getElementById('selectedCodparc');

let searchTimeout = null;

clientNameInput.addEventListener('input', (e) => {
    const term = e.target.value;

    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);

    if (term.length < 3) {
        partnerResults.classList.add('hidden');
        selectedCodparcInput.value = '';
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/pdv/partners?term=${encodeURIComponent(term)}`);
            const partners = await response.json();
            renderPartnerResults(partners);
        } catch (error) {
            console.error('Error searching partners:', error);
        }
    }, 300);
});

function renderPartnerResults(partners) {
    if (partners.length === 0) {
        partnerResults.innerHTML = '<div class="p-3 text-sm text-gray-500">Nenhum cliente encontrado</div>';
    } else {
        partnerResults.innerHTML = partners.map(p => `
            <div class="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0" onclick="selectPartner('${p.CODPARC}', '${p.RAZAOSOCIAL}', '${p.CGC_CPF}')">
                <div class="font-medium text-gray-900">${p.RAZAOSOCIAL}</div>
                <div class="text-xs text-gray-500">Cód: ${p.CODPARC} | CNPJ/CPF: ${p.CGC_CPF || 'N/A'}</div>
            </div>
        `).join('');
    }
    partnerResults.classList.remove('hidden');
}

function selectPartner(codparc, name, cgc) {
    clientNameInput.value = name;
    selectedCodparcInput.value = codparc;
    partnerResults.classList.add('hidden');
}

// Close results when clicking outside
document.addEventListener('click', (e) => {
    if (!clientNameInput.contains(e.target) && !partnerResults.contains(e.target)) {
        partnerResults.classList.add('hidden');
    }
});

function selectPayment(method) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-btn').forEach(btn => {
        if (btn.dataset.method === method) {
            btn.className = "payment-btn flex flex-col items-center justify-center p-4 rounded-xl border-2 border-green-600 bg-green-50 text-green-700 transition-all";
        } else {
            btn.className = "payment-btn flex flex-col items-center justify-center p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 transition-all";
        }
    });

    openPaymentModal(method);
}

let allPaymentMethods = [];

async function openPaymentModal(type) {
    const list = document.getElementById('paymentMethodsList');
    const searchInput = document.getElementById('paymentSearch');
    list.innerHTML = '<div class="p-4 text-center text-gray-500">Carregando...</div>';
    searchInput.value = '';
    document.getElementById('paymentModal').classList.remove('hidden');

    try {
        const response = await fetch(`/pdv/payment-methods?type=${type}`);
        allPaymentMethods = await response.json();
        renderPaymentMethods(allPaymentMethods);
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        list.innerHTML = '<div class="p-4 text-center text-red-500">Erro ao carregar opções</div>';
    }
}

document.getElementById('paymentSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allPaymentMethods.filter(m =>
        m.DESCRTIPVENDA.toLowerCase().includes(term)
    );
    renderPaymentMethods(filtered);
});

function renderPaymentMethods(methods) {
    const list = document.getElementById('paymentMethodsList');
    if (methods.length === 0) {
        list.innerHTML = '<div class="p-4 text-center text-gray-500">Nenhuma opção encontrada</div>';
    } else {
        list.innerHTML = methods.map(m => `
            <button onclick="selectCardMethod('${m.CODTIPVENDA}', '${m.DESCRTIPVENDA}')" class="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all">
                <span class="font-medium text-gray-900">${m.DESCRTIPVENDA}</span>
            </button>
        `).join('');
    }
}

function selectCardMethod(codtipvenda, descr) {
    document.getElementById('selectedCodtipvenda').value = codtipvenda;
    // Update the button text to show the selected method
    const btn = document.querySelector(`.payment-btn[data-method="${selectedPaymentMethod}"] span`);
    btn.textContent = descr;
    closePaymentModal();
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

async function checkAndCreateHeader() {
    let codparc = document.getElementById('selectedCodparc').value;
    const codtipvenda = document.getElementById('selectedCodtipvenda').value;

    if (!codparc) {
        codparc = '1';
        document.getElementById('selectedCodparc').value = '1';
        document.getElementById('clientName').value = 'CONSUMIDOR FINAL';
    }
    if (!codtipvenda) {
        alert('Por favor, selecione uma forma de pagamento.');
        return false;
    }

    if (!currentNunota) {
        try {
            console.log('Attempting to create order header...');
            const response = await fetch('/pdv/create-header', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codparc, codtipvenda })
            });
            const result = await response.json();
            if (result.success) {
                currentNunota = result.nunota;
                console.log('Order header created successfully. NUNOTA:', currentNunota);
                return true;
            } else {
                console.error('Failed to create order header:', result.message);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Erro ao iniciar pedido no sistema: ' + result.message
                });
                return false;
            }
        } catch (error) {
            console.error('Error creating order header:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro de Conexão',
                text: 'Erro de conexão ao criar pedido.'
            });
            return false;
        }
    }
    return true; // Already has a NUNOTA
}

// Step 2: Products
function renderProducts(products) {
    productGrid.innerHTML = products.map(product => `
        <div class="touch-active product-card-mobile rounded-xl border-2 border-gray-200 bg-white text-gray-950 shadow-sm cursor-pointer transition-all" onclick="openModal('${product.id}')">
            <div class="p-4 flex flex-col h-full justify-between min-h-[130px]">
                <div>
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <span class="text-xs font-semibold bg-gray-100 px-2 py-1 rounded-lg text-gray-600 shrink-0">
                            ${product.reference || product.code}
                        </span>
                        <span class="text-[10px] text-gray-400 truncate text-right">${product.brand || product.category}</span>
                    </div>
                    <h4 class="font-semibold text-gray-900 line-clamp-2 text-sm sm:text-base leading-tight">${product.name}</h4>
                </div>
                <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <span class="font-bold text-lg sm:text-xl text-blue-600">
                        R$ ${product.price.toFixed(2)}
                    </span>
                    <div class="bg-blue-600 p-2 rounded-xl text-white shadow-sm">
                        <i data-lucide="plus" class="w-5 h-5"></i>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}


async function fetchBrands() {
    try {
        const response = await fetch('/pdv/marcas');
        allBrands = await response.json();
        populateBrandDropdown(allBrands);
    } catch (error) {
        console.error('Error fetching brands:', error);
    }
}

function populateBrandDropdown(brands) {
    const desktopSelect = document.getElementById('brandFilterDesktop');
    if (desktopSelect) {
        desktopSelect.innerHTML = '<option value="">Todas as Marcas</option>' +
            brands.map(b => `<option value="${b.DESCRICAO}">${b.DESCRICAO}</option>`).join('');
    }
}

function openBrandModal() {
    document.getElementById('brandModal').classList.remove('hidden');
    renderBrandList(allBrands);
}

function closeBrandModal() {
    document.getElementById('brandModal').classList.add('hidden');
}

document.getElementById('brandSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allBrands.filter(b => b.DESCRICAO.toLowerCase().includes(term));
    renderBrandList(filtered);
});

function renderBrandList(brands) {
    const list = document.getElementById('brandList');
    list.innerHTML = `
        <button onclick="selectBrand('')" class="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all">
            <span class="font-medium text-gray-900">Todas as Marcas</span>
        </button>
    ` + brands.map(b => `
        <button onclick="selectBrand('${b.DESCRICAO}')" class="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all">
            <span class="font-medium text-gray-900">${b.DESCRICAO}</span>
        </button>
    `).join('');
}

function selectBrand(brand) {
    selectedBrand = brand;

    // Update Desktop Select
    const desktopSelect = document.getElementById('brandFilterDesktop');
    if (desktopSelect) desktopSelect.value = brand;

    // Update Mobile Label
    const mobileLabel = document.getElementById('selectedBrandMobileLabel');
    if (mobileLabel) mobileLabel.textContent = brand || 'Todas as Marcas';

    closeBrandModal();
    performProductSearch();
}

if (document.getElementById('brandFilterDesktop')) {
    document.getElementById('brandFilterDesktop').addEventListener('change', (e) => {
        selectedBrand = e.target.value;
        performProductSearch();
    });
}

let productSearchTimeout = null;

productSearch.addEventListener('input', (e) => {
    performProductSearch();
});

function performProductSearch() {
    const term = productSearch.value;

    if (productSearchTimeout) clearTimeout(productSearchTimeout);

    if (term.length < 3 && !selectedBrand) {
        productGrid.innerHTML = '';
        return;
    }

    productSearchTimeout = setTimeout(async () => {
        try {
            productGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">Buscando...</div>';
            const url = `/pdv/products?term=${encodeURIComponent(term)}&marca=${encodeURIComponent(selectedBrand)}`;
            const response = await fetch(url);
            PRODUCTS = await response.json();

            if (PRODUCTS.length === 0) {
                productGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">Nenhum produto encontrado</div>';
            } else {
                renderProducts(PRODUCTS);
            }
        } catch (error) {
            console.error('Error searching products:', error);
            productGrid.innerHTML = '<div class="col-span-full text-center py-8 text-red-500">Erro ao buscar produtos</div>';
        }
    }, 500);
}

// Modal Logic
function openModal(productId, cartIndex = -1) {
    let product;
    editingCartIndex = cartIndex;

    if (cartIndex >= 0) {
        product = cart[cartIndex];
    } else {
        product = PRODUCTS.find(p => p.id == productId);
    }

    if (!product) return;

    currentModalProduct = product;
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductPrice').textContent = `R$ ${product.price.toFixed(2)}`;
    document.getElementById('modalQuantity').value = product.quantity || 1;

    if (cartIndex >= 0) {
        document.getElementById('modalDiscountValue').value = product.discount || 0;
        const total = product.price * product.quantity;
        document.getElementById('modalDiscountPercent').value = total > 0 ? ((product.discount / total) * 100).toFixed(2) : 0;
    } else {
        document.getElementById('modalDiscountValue').value = 0;
        document.getElementById('modalDiscountPercent').value = 0;
    }

    updateModalTotals();
    itemModal.classList.remove('hidden');
}

function closeModal() {
    itemModal.classList.add('hidden');
    currentModalProduct = null;
}

function updateQuantity(delta) {
    const input = document.getElementById('modalQuantity');
    let val = parseInt(input.value) || 1;
    val = Math.max(1, val + delta);
    input.value = val;
    updateModalTotals();
}

document.getElementById('modalQuantity').addEventListener('change', updateModalTotals);

document.getElementById('modalDiscountValue').addEventListener('input', (e) => {
    if (!currentModalProduct) return;
    const quantity = parseInt(document.getElementById('modalQuantity').value) || 1;
    const total = currentModalProduct.price * quantity;
    const val = parseFloat(e.target.value) || 0;

    // Update percent
    if (total > 0) {
        document.getElementById('modalDiscountPercent').value = ((val / total) * 100).toFixed(2);
    }
    updateModalTotals();
});

document.getElementById('modalDiscountPercent').addEventListener('input', (e) => {
    if (!currentModalProduct) return;
    const quantity = parseInt(document.getElementById('modalQuantity').value) || 1;
    const total = currentModalProduct.price * quantity;
    const percent = parseFloat(e.target.value) || 0;

    // Update value
    document.getElementById('modalDiscountValue').value = ((percent / 100) * total).toFixed(2);
    updateModalTotals();
});

function updateModalTotals() {
    if (!currentModalProduct) return;
    const quantity = parseInt(document.getElementById('modalQuantity').value) || 1;
    const discount = parseFloat(document.getElementById('modalDiscountValue').value) || 0;
    const total = (currentModalProduct.price * quantity) - discount;

    document.getElementById('modalFinalTotal').textContent = `R$ ${total.toFixed(2)}`;
}

function confirmAddItem() {
    if (!currentModalProduct) return;

    const quantity = parseInt(document.getElementById('modalQuantity').value) || 1;
    const discount = parseFloat(document.getElementById('modalDiscountValue').value) || 0;

    if (editingCartIndex >= 0) {
        // Update existing item
        cart[editingCartIndex].quantity = quantity;
        cart[editingCartIndex].discount = discount;
    } else {
        // Add new item or update existing if same ID
        const existingItem = cart.find(i => i.id == currentModalProduct.id);
        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.discount += discount;
        } else {
            cart.push({
                ...currentModalProduct,
                quantity,
                discount
            });
        }
    }

    closeModal();
    renderStep2Cart();
    renderCartSummary();
    updateMobileCartBadge();
    // Show brief success feedback
    showAddToCartFeedback();
}

// Brief visual feedback when item is added
function showAddToCartFeedback() {
    const btn = document.getElementById('floatingCartBtn');
    if (btn) {
        btn.classList.add('animate-scale-in');
        setTimeout(() => btn.classList.remove('animate-scale-in'), 300);
    }
}

// Step 3: Summary
function renderCartSummary() {
    const list = document.getElementById('cartItemsList');
    let subtotal = 0;
    let itemDiscounts = 0;

    if (cart.length === 0) {
        list.innerHTML = '<li class="p-4 text-center text-gray-500">Carrinho vazio</li>';
    } else {
        list.innerHTML = cart.map(item => {
            const itemTotal = Number(item.price) * Number(item.quantity);
            subtotal += itemTotal;
            itemDiscounts += (Number(item.discount) || 0);

            return `
                <li class="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors" onclick="openModal('${item.id}', ${cart.indexOf(item)})">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${item.name}</h4>
                        <div class="text-xs text-gray-500 mb-1">
                            ${item.brand ? `Marca: ${item.brand} | ` : ''} Ref: ${item.reference || item.code}
                        </div>
                        <div class="text-sm text-gray-500">
                            ${item.quantity}x R$ ${item.price.toFixed(2)}
                            ${item.discount > 0 ? `<span class="ml-2 text-red-500">(-R$ ${item.discount.toFixed(2)})</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="font-medium">
                            R$ ${(itemTotal - item.discount).toFixed(2)}
                        </span>
                        <button onclick="event.stopPropagation(); removeFromCart('${item.id}')" class="text-gray-400 hover:text-red-500 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('');
        lucide.createIcons();
    }

    const itemDiscountPercent = subtotal > 0 ? (itemDiscounts / subtotal) * 100 : 0;
    document.getElementById('summarySubtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('summaryItemDiscounts').textContent = `R$ ${itemDiscounts.toFixed(2)} (${itemDiscountPercent.toFixed(2)}%)`;

    updateFinalTotal(subtotal, itemDiscounts);
}

function renderStep2Cart() {
    const list = document.getElementById('step2CartList');
    const countBadge = document.getElementById('step2ItemCount');
    const partialTotal = document.getElementById('step2PartialTotal');

    let total = 0;
    let count = 0;

    if (cart.length === 0) {
        list.innerHTML = '<li class="p-8 text-center text-gray-400 text-sm">Nenhum item adicionado</li>';
        countBadge.textContent = '0';
        partialTotal.textContent = 'R$ 0,00';
    } else {
        list.innerHTML = cart.map(item => {
            const itemTotal = (Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0);
            total += itemTotal;
            count += Number(item.quantity);

            return `
                <li class="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors" onclick="openModal('${item.id}', ${cart.indexOf(item)})">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-medium text-gray-900 text-sm truncate">${item.name}</h4>
                        <div class="text-[10px] text-gray-500 truncate">
                            ${item.brand ? `Marca: ${item.brand} | ` : ''} Ref: ${item.reference || item.code}
                        </div>
                        <div class="text-xs text-gray-500 mt-0.5">
                            ${item.quantity}x R$ ${item.price.toFixed(2)}
                        </div>
                    </div>
                    <div class="flex items-center gap-3 ml-4">
                        <span class="font-semibold text-sm text-gray-900">
                            R$ ${itemTotal.toFixed(2)}
                        </span>
                        <button onclick="event.stopPropagation(); removeFromCart('${item.id}')" class="text-gray-400 hover:text-red-500 transition-colors p-1">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('');

        countBadge.textContent = count;
        partialTotal.textContent = `R$ ${total.toFixed(2)}`;
        lucide.createIcons();
    }
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id != id);
    renderCartSummary();
    renderStep2Cart();
}

document.getElementById('additionalDiscount').addEventListener('input', () => {
    renderCartSummary(); // Re-trigger total calc
});

function updateFinalTotal(subtotal, itemDiscounts) {
    const additionalDiscount = parseFloat(document.getElementById('additionalDiscount').value) || 0;
    const total = Math.max(0, subtotal - itemDiscounts - additionalDiscount);
    document.getElementById('summaryTotal').textContent = `R$ ${total.toFixed(2)}`;
}

// Bidirectional Additional Discount Logic
document.getElementById('additionalDiscount').addEventListener('input', (e) => {
    const subtotalText = document.getElementById('summarySubtotal').textContent;
    const subtotal = parseFloat(subtotalText.replace('R$ ', '').replace(',', '.')) || 0;
    const val = parseFloat(e.target.value) || 0;

    if (subtotal > 0) {
        document.getElementById('additionalDiscountPercent').value = ((val / subtotal) * 100).toFixed(2);
    }
    renderCartSummary();
});

document.getElementById('additionalDiscountPercent').addEventListener('input', (e) => {
    const subtotalText = document.getElementById('summarySubtotal').textContent;
    const subtotal = parseFloat(subtotalText.replace('R$ ', '').replace(',', '.')) || 0;
    const percent = parseFloat(e.target.value) || 0;

    document.getElementById('additionalDiscount').value = ((percent / 100) * subtotal).toFixed(2);
    renderCartSummary();
});

async function finalizeOrder() {
    let clientName = document.getElementById('clientName').value;
    if (!clientName) {
        clientName = 'CONSUMIDOR FINAL';
        document.getElementById('clientName').value = clientName;
        document.getElementById('selectedCodparc').value = '1';
    }
    if (!selectedPaymentMethod) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Por favor, selecione uma forma de pagamento.'
        });
        goToStep(1);
        return;
    }
    if (cart.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Carrinho Vazio',
            text: 'O carrinho está vazio.'
        });
        goToStep(2);
        return;
    }

    const additionalDiscount = parseFloat(document.getElementById('additionalDiscount').value) || 0;
    const codparc = document.getElementById('selectedCodparc').value;
    const codtipvenda = document.getElementById('selectedCodtipvenda').value;

    const orderData = {
        nunota: currentNunota,
        clientName,
        codparc,
        paymentMethod: selectedPaymentMethod,
        codtipvenda,
        items: cart,
        additionalDiscount
    };

    try {
        const response = await fetch('/pdv/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: 'Pedido realizado com sucesso!',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                window.location.href = '/pdv/sales';
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro ao Salvar',
                text: result.message
            });
        }
    } catch (error) {
        console.error(error);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Conexão',
            text: 'Erro de conexão com o servidor.'
        });
    }
}

// Mobile Cart Modal
function openMobileCart() {
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = cart.reduce((sum, item) => sum + (item.price * item.quantity) - (item.discount || 0), 0);

    // Create modal HTML
    const modalHTML = `
        <div id="mobileCartModal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div class="cart-modal-mobile w-full bg-white rounded-t-3xl shadow-xl max-h-[90vh] flex flex-col animate-slide-up">
                <!-- Header -->
                <div class="cart-modal-header flex items-center justify-between p-4 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="bg-blue-100 p-2 rounded-xl">
                            <i data-lucide="shopping-cart" class="w-5 h-5 text-blue-600"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-900">Carrinho</h3>
                            <p class="text-xs text-gray-500">${itemCount} ${itemCount === 1 ? 'item' : 'itens'}</p>
                        </div>
                    </div>
                    <button onclick="closeMobileCart()" class="touch-active p-2 bg-gray-100 rounded-full">
                        <i data-lucide="x" class="w-5 h-5 text-gray-600"></i>
                    </button>
                </div>
                
                <!-- Body -->
                <div class="cart-modal-body flex-1 overflow-y-auto p-4">
                    ${cart.length === 0 ? `
                        <div class="flex flex-col items-center justify-center py-12 text-gray-400">
                            <i data-lucide="shopping-bag" class="w-16 h-16 mb-4 opacity-50"></i>
                            <p class="text-lg font-medium">Carrinho vazio</p>
                            <p class="text-sm">Adicione produtos para continuar</p>
                        </div>
                    ` : cart.map((item, index) => `
                        <div class="touch-active flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2" onclick="closeMobileCart(); openModal('${item.id}', ${index})">
                            <div class="flex-1 min-w-0">
                                <h4 class="font-semibold text-gray-900 text-sm truncate">${item.name}</h4>
                                <p class="text-xs text-gray-500">${item.quantity}x R$ ${item.price.toFixed(2)}</p>
                                ${item.discount > 0 ? `<p class="text-xs text-red-500">-R$ ${item.discount.toFixed(2)}</p>` : ''}
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-gray-900">R$ ${((item.price * item.quantity) - (item.discount || 0)).toFixed(2)}</p>
                            </div>
                            <button onclick="event.stopPropagation(); removeFromCartMobile('${item.id}')" class="touch-active p-2 text-red-500 bg-red-50 rounded-lg">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Footer -->
                <div class="cart-modal-footer p-4 border-t border-gray-100 bg-white space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600 font-medium">Total</span>
                        <span class="text-2xl font-bold text-green-600">R$ ${totalValue.toFixed(2)}</span>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="closeMobileCart()" class="touch-active flex-1 h-12 rounded-xl border-2 border-gray-200 font-semibold text-gray-700">
                            Continuar
                        </button>
                        <button onclick="closeMobileCart(); nextStep()" class="touch-active flex-1 h-12 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold shadow-lg ${cart.length === 0 ? 'opacity-50 pointer-events-none' : ''}">
                            Finalizar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    lucide.createIcons();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function closeMobileCart() {
    const modal = document.getElementById('mobileCartModal');
    if (modal) {
        modal.querySelector('.cart-modal-mobile').classList.add('closing');
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 250);
    }
}

function removeFromCartMobile(id) {
    cart = cart.filter(i => i.id != id);
    closeMobileCart();
    setTimeout(() => {
        openMobileCart();
        renderStep2Cart();
        updateMobileCartBadge();
    }, 300);
}

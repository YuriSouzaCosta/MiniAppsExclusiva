// Mock Products
const PRODUCTS = [
    { id: '1', code: '001', name: 'Camiseta Básica', price: 49.90, category: 'Roupas' },
    { id: '2', code: '002', name: 'Calça Jeans', price: 129.90, category: 'Roupas' },
    { id: '3', code: '003', name: 'Tênis Casual', price: 199.90, category: 'Calçados' },
    { id: '4', code: '004', name: 'Boné', price: 29.90, category: 'Acessórios' },
    { id: '5', code: '005', name: 'Meias (Par)', price: 12.90, category: 'Acessórios' },
    { id: '6', code: '006', name: 'Jaqueta', price: 259.90, category: 'Roupas' },
];

// State
let currentStep = 1;
let cart = [];
let selectedPaymentMethod = '';
let currentModalProduct = null;

// DOM Elements
const progressBar = document.getElementById('progressBar');
const productGrid = document.getElementById('productGrid');
const productSearch = document.getElementById('productSearch');
const itemModal = document.getElementById('itemModal');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    renderProducts(PRODUCTS);
    updateUI();
});

// Navigation
function goToStep(step) {
    if (step < 1 || step > 3) return;
    currentStep = step;
    updateUI();
}

function nextStep() {
    goToStep(currentStep + 1);
}

function prevStep() {
    goToStep(currentStep - 1);
}

function updateUI() {
    // Update Progress Bar
    const progress = ((currentStep - 1) / 2) * 100;
    progressBar.style.width = `${progress}%`;

    // Update Indicators
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`step${i}Indicator`);
        const label = indicator.nextElementSibling;

        if (i === currentStep) {
            indicator.className = "w-10 h-10 rounded-full flex items-center justify-center border-2 border-green-600 bg-white text-green-600 transition-colors";
            label.className = "text-xs font-medium mt-2 text-green-700";
        } else if (i < currentStep) {
            indicator.className = "w-10 h-10 rounded-full flex items-center justify-center border-2 border-green-600 bg-green-600 text-white transition-colors";
            indicator.innerHTML = '<i data-lucide="check" class="w-6 h-6"></i>';
            label.className = "text-xs font-medium mt-2 text-gray-500";
        } else {
            indicator.className = "w-10 h-10 rounded-full flex items-center justify-center border-2 border-gray-300 bg-white text-gray-400 transition-colors";
            indicator.innerHTML = `<span class="font-bold">${i}</span>`;
            label.className = "text-xs font-medium mt-2 text-gray-500";
        }
    }
    lucide.createIcons();

    // Show/Hide Steps
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step${currentStep}`).classList.remove('hidden');

    // Update Buttons
    document.getElementById('prevBtn').disabled = currentStep === 1;
    document.getElementById('nextBtn').style.display = currentStep === 3 ? 'none' : 'inline-flex';

    // Refresh Summary if on step 3
    if (currentStep === 3) {
        renderCartSummary();
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
}

// Step 2: Products
function renderProducts(products) {
    productGrid.innerHTML = products.map(product => `
        <div class="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm cursor-pointer hover:border-blue-500 transition-colors group" onclick="openModal('${product.id}')">
            <div class="p-4 flex flex-col h-full justify-between">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-medium bg-gray-100 px-2 py-1 rounded text-gray-600">
                            ${product.code}
                        </span>
                        <span class="text-xs text-gray-400">${product.category}</span>
                    </div>
                    <h4 class="font-medium text-gray-900 line-clamp-2 mb-2">${product.name}</h4>
                </div>
                <div class="flex items-center justify-between mt-2">
                    <span class="font-bold text-lg text-blue-600">
                        R$ ${product.price.toFixed(2)}
                    </span>
                    <div class="bg-blue-50 p-1.5 rounded-full text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

productSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.code.includes(term)
    );
    renderProducts(filtered);
});

// Modal Logic
function openModal(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    currentModalProduct = product;
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductPrice').textContent = `R$ ${product.price.toFixed(2)}`;
    document.getElementById('modalQuantity').value = 1;
    document.getElementById('modalDiscountValue').value = 0;
    document.getElementById('modalDiscountPercent').value = 0;

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

    const existingItem = cart.find(i => i.id === currentModalProduct.id);
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

    closeModal();
    // Optional toast notification here
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
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            itemDiscounts += item.discount;

            return `
                <li class="flex items-center justify-between p-4">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${item.name}</h4>
                        <div class="text-sm text-gray-500">
                            ${item.quantity}x R$ ${item.price.toFixed(2)}
                            ${item.discount > 0 ? `<span class="ml-2 text-red-500">(-R$ ${item.discount.toFixed(2)})</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="font-medium">
                            R$ ${(itemTotal - item.discount).toFixed(2)}
                        </span>
                        <button onclick="removeFromCart('${item.id}')" class="text-gray-400 hover:text-red-500 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('');
        lucide.createIcons();
    }

    document.getElementById('summarySubtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('summaryItemDiscounts').textContent = `- R$ ${itemDiscounts.toFixed(2)}`;

    updateFinalTotal(subtotal, itemDiscounts);
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    renderCartSummary();
}

document.getElementById('additionalDiscount').addEventListener('input', () => {
    renderCartSummary(); // Re-trigger total calc
});

function updateFinalTotal(subtotal, itemDiscounts) {
    const additionalDiscount = parseFloat(document.getElementById('additionalDiscount').value) || 0;
    const total = Math.max(0, subtotal - itemDiscounts - additionalDiscount);
    document.getElementById('summaryTotal').textContent = `R$ ${total.toFixed(2)}`;
}

async function finalizeOrder() {
    const clientName = document.getElementById('clientName').value;
    if (!clientName) {
        alert('Por favor, informe o nome do cliente.');
        goToStep(1);
        return;
    }
    if (!selectedPaymentMethod) {
        alert('Por favor, selecione uma forma de pagamento.');
        goToStep(1);
        return;
    }
    if (cart.length === 0) {
        alert('O carrinho está vazio.');
        goToStep(2);
        return;
    }

    const additionalDiscount = parseFloat(document.getElementById('additionalDiscount').value) || 0;
    const codparc = document.getElementById('selectedCodparc').value;

    const orderData = {
        clientName,
        codparc,
        paymentMethod: selectedPaymentMethod,
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
            alert('Pedido realizado com sucesso!');
            window.location.href = '/pdv/sales';
        } else {
            alert('Erro ao salvar pedido: ' + result.message);
        }
    } catch (error) {
        console.error(error);
        alert('Erro de conexão.');
    }
}

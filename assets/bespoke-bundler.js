document.addEventListener('DOMContentLoaded', () => {
    const bundler = document.querySelector('.atelier-bundler');
    if (!bundler) return;

    const domain = bundler.dataset.shopDomain;
    const token = bundler.dataset.storefrontToken;

    const state = {
        selectedItems: [], // Max 3 items: { id, gqlId, title, price, image }
    };

    const progressBar = document.getElementById('bundle-progress-bar');
    const countBadge = document.getElementById('ribbon-count-badge');
    const slotsBadge = document.getElementById('coffret-slots-badge');
    const tierLabel = document.getElementById('ribbon-tier-label');
    const incentivePill = document.getElementById('ribbon-incentive-pill');
    const slotsContainer = document.getElementById('coffret-slots-container');
    const retailPriceEl = document.getElementById('val-retail-price');
    const savingsEl = document.getElementById('val-savings-amount');
    const finalTotalEl = document.getElementById('val-final-total');
    const discountBadge = document.getElementById('valuation-discount-badge');
    const checkoutBtn = document.getElementById('btn-claim-bundle');
    const checkoutBtnPrice = document.getElementById('btn-price-display');

    function formatMoney(cents) {
        return '$' + (cents / 100).toFixed(2);
    }

    function getTierRate(count) {
        if (count === 2) return 0.10; // 10%
        if (count >= 3) return 0.20; // 20%
        return 0.0;
    }

    function render() {
        const count = state.selectedItems.length;
        const rate = getTierRate(count);

        progressBar.style.width = (count / 3) * 100 + '%';
        countBadge.textContent = `${count}/3`;
        slotsBadge.textContent = `${count} / 3 Filled`;

        if (count === 0) {
            tierLabel.textContent = 'Tier 01: Standard Retail';
            incentivePill.innerHTML = 'Add 1 more formula to unlock <strong>10% OFF</strong>';
            discountBadge.textContent = 'No Discount';
        } else if (count === 1) {
            tierLabel.textContent = 'Tier 01 Active: Standard Pricing';
            incentivePill.innerHTML = 'Add 1 more formula to unlock <strong>10% OFF</strong>';
            discountBadge.textContent = 'Tier 01';
        } else if (count === 2) {
            tierLabel.textContent = 'Tier 02 Active: 10% Bundle Privileges Applied';
            incentivePill.innerHTML = 'Add 1 more formula to unlock <strong>20% OFF Coffret</strong>';
            discountBadge.textContent = '10% Applied';
        } else {
            tierLabel.textContent = 'Tier 03 Active: 20% Full Coffret Privileges Unlocked';
            incentivePill.innerHTML = '<strong>Maximum Tier Unlocked!</strong>';
            discountBadge.textContent = '20% OFF Coffret';
        }

        const slots = slotsContainer.querySelectorAll('.coffret-slot');
        slots.forEach((slot, index) => {
            const item = state.selectedItems[index];
            if (item) {
                slot.className = 'coffret-slot filled';
                slot.innerHTML = `
          <img src="${item.image}" alt="${item.title}">
          <div class="slot-info">
            <span class="slot-tag">Slot 0${index + 1} • Locked In</span>
            <h4 class="slot-title">${item.title}</h4>
            <span style="font-size:12px; font-weight:600;">${formatMoney(item.price)}</span>
          </div>
          <button type="button" class="btn-slot-remove" data-index="${index}" title="Remove item">✕</button>
        `;
            } else {
                slot.className = 'coffret-slot empty';
                slot.innerHTML = `
          <div class="slot-placeholder"><span class="slot-plus-icon">+</span></div>
          <div class="slot-info">
            <span class="slot-tag">Slot 0${index + 1} • Empty</span>
            <h4 class="slot-title">Select Formulation</h4>
          </div>
        `;
            }
        });

        const rawTotal = state.selectedItems.reduce((acc, curr) => acc + curr.price, 0);
        const savings = Math.round(rawTotal * rate);
        const finalTotal = rawTotal - savings;

        retailPriceEl.textContent = formatMoney(rawTotal);
        savingsEl.textContent = `-${formatMoney(savings)}`;
        finalTotalEl.textContent = formatMoney(finalTotal);
        checkoutBtnPrice.textContent = `${formatMoney(finalTotal)} →`;

        checkoutBtn.disabled = count === 0;
    }

    document.querySelectorAll('.btn-add-slot').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            if (state.selectedItems.length >= 3) {
                alert('Your presentation coffret is full (3/3 items). Remove an item to replace it.');
                return;
            }
            const card = e.target.closest('.dispensary-card');
            state.selectedItems.push({
                id: card.dataset.variantId,
                gqlId: card.dataset.variantGql,
                title: card.dataset.title,
                price: parseInt(card.dataset.price, 10),
                image: card.dataset.image,
            });
            render();
        });
    });

    slotsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-slot-remove')) {
            const idx = parseInt(e.target.dataset.index, 10);
            state.selectedItems.splice(idx, 1);
            render();
        }
    });

    checkoutBtn.addEventListener('click', async () => {
        if (state.selectedItems.length === 0) return;

        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Preparing Your Coffret...';

        const lines = state.selectedItems.map((item) => ({
            merchandiseId: item.gqlId,
            quantity: 1,
            attributes: [
                { key: '_bundle_tier', value: `${getTierRate(state.selectedItems.length) * 100}%` },
                { key: 'Packaging', value: 'Bespoke Linen Presentation Coffret' }
            ]
        }));

        const mutation = `
      mutation createBundleCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            checkoutUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

        try {
            const res = await fetch(`https://${domain}/api/2024-01/graphql.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Storefront-Access-Token': token,
                },
                body: JSON.stringify({ query: mutation, variables: { input: { lines } } }),
            });

            const { data } = await res.json();
            if (data?.cartCreate?.cart?.checkoutUrl) {
                window.location.href = data.cartCreate.cart.checkoutUrl;
            } else {
                window.location.href = `/cart/${state.selectedItems.map(i => `${i.id}:1`).join(',')}`;
            }
        } catch (err) {
            console.warn('Storefront API call bypassed; using standard Shopify checkout fallback:', err);
            window.location.href = `/cart/${state.selectedItems.map(i => `${i.id}:1`).join(',')}`;
        }
    });

    render();
});
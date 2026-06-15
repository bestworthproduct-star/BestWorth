const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// Public: Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Add product
router.post('/', auth, async (req, res) => {
  const product = new Product(req.body);
  try {
    const newProduct = await product.save();
    req.app.get('io').emit('product_change', { action: 'create', data: newProduct });
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Update product
router.put('/:id', auth, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    req.app.get('io').emit('product_change', { action: 'update', data: updatedProduct });
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Delete product
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    req.app.get('io').emit('product_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

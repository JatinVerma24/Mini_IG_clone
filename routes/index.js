const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');

router.get('/', (req, res) => {
    res.redirect('/login');
});

router.get('/login', (req, res) => {
    if (req.cookies.token) {
        return res.redirect('/feed');
    }
    res.render('login');
});

router.get('/register', (req, res) => {
    if (req.cookies.token) {
        return res.redirect('/feed');
    }
    res.render('register');
});

router.get('/create-post', protect, (req, res) => {
    res.render('create-post', { user: req.user });
});

router.get('/edit-post/:id', protect, async (req, res) => {
    try {
        const Post = require('../models/Post');
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).send('Post not found');
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).send('Not authorized');
        }

        res.render('edit-post', { user: req.user, post });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;

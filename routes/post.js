const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

// Create post
router.post('/post', protect, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No media file provided' });
        }

        const post = await Post.create({
            caption: req.body.caption,
            mediaUrl: req.file.path,
            user: req.user._id
        });

        await User.findByIdAndUpdate(req.user._id, { $push: { posts: post._id } });

        if (req.accepts('html')) {
            return res.redirect('/feed');
        }

        res.status(201).json(post);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Like/Unlike a post
router.put('/post/:id/like', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if the post has already been liked by this user
        if (post.likes.some(like => like.toString() === req.user._id.toString())) {
            // Unlike
            post.likes = post.likes.filter(like => like.toString() !== req.user._id.toString());
        } else {
            // Like
            post.likes.unshift(req.user._id);
        }

        await post.save();
        res.json(post.likes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Add a comment to a post
router.post('/post/:id/comment', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const newComment = {
            user: req.user._id,
            text: req.body.text
        };

        post.comments.push(newComment);
        await post.save();

        // Need to return populated user for the new comment
        const populatedPost = await Post.findById(req.params.id).populate('comments.user', 'username');

        // Check if user expects html or json
        if (req.accepts('html')) {
            return res.redirect('/feed'); // Simple reload for EJS
        }

        res.json(populatedPost.comments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Update post caption
router.put('/post/:id', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'User not authorized to update this post' });
        }

        post.caption = req.body.caption || post.caption;
        const updatedPost = await post.save();

        if (req.accepts('html')) {
            return res.redirect('/feed');
        }

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Delete post
router.delete('/post/:id', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'User not authorized to delete this post' });
        }

        await Post.findByIdAndDelete(req.params.id);
        await User.findByIdAndUpdate(req.user._id, { $pull: { posts: post._id } });

        res.json({ message: 'Post removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get Feed (Paginated)
router.get('/feed', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 4;
        const startIndex = (page - 1) * limit;

        const posts = await Post.find()
            .populate('user', 'username')
            .populate('comments.user', 'username')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit);

        const total = await Post.countDocuments();
        const totalPages = Math.ceil(total / limit);

        if (req.accepts('html')) {
            return res.render('feed', { posts, page, totalPages, user: req.user });
        }

        res.json({
            success: true,
            count: posts.length,
            page,
            totalPages,
            data: posts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

// Upload Profile Picture
router.post('/profile/upload-pic', protect, upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.profilePic = req.file.path;
        await user.save();

        if (req.accepts('html')) {
            return res.redirect(`/profile/${user.username}`);
        }

        res.json({ message: 'Profile picture updated', profilePic: user.profilePic });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get Profile by username
router.get('/profile/:username', protect, async (req, res) => {
    try {
        const profileUser = await User.findOne({ username: req.params.username })
            .populate('followers', 'username profilePic')
            .populate('following', 'username profilePic');

        if (!profileUser) {
            return res.status(404).send('User not found');
        }

        const posts = await Post.find({ user: profileUser._id }).sort({ createdAt: -1 });

        res.render('profile', {
            user: req.user, // Current logged-in user from protect middleware
            profileUser,
            posts
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Follow/Unfollow a user
router.put('/profile/:id/follow', protect, async (req, res) => {
    try {
        const userToFollow = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!userToFollow || !currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (userToFollow._id.toString() === currentUser._id.toString()) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        const isFollowing = currentUser.following.some(
            id => id.toString() === userToFollow._id.toString()
        );

        if (isFollowing) {
            // Unfollow
            currentUser.following = currentUser.following.filter(
                id => id.toString() !== userToFollow._id.toString()
            );
            userToFollow.followers = userToFollow.followers.filter(
                id => id.toString() !== currentUser._id.toString()
            );
        } else {
            // Follow
            currentUser.following.push(userToFollow._id);
            userToFollow.followers.push(currentUser._id);
        }

        await currentUser.save();
        await userToFollow.save();

        res.json({
            followersCount: userToFollow.followers.length,
            followingCount: userToFollow.following.length,
            isFollowing: !isFollowing
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;

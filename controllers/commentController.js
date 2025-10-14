// Get comments for a post
export const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate('user', 'name username avatar verified')
      .populate('likes', 'name username avatar verified')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create comment
export const createComment = async (req, res) => {
  try {
    const comment = await Comment.create({
      user: req.user._id,
      post: req.params.postId,
      text: req.body.text
    });

    await comment.populate('user', 'name username avatar verified');

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
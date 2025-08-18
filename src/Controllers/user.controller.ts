import User, { IUser } from "../Models/user.model";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";

const userController = {
  getProfile: catchError(async (req, res) => {
    //@ts-ignore
    const user = await User.findById(req.user.id);
    res
      .status(200)
      .json({ message: "User profile retrieved successfully", data: user });
  }),

  updateProfile: catchError(async (req, res) => {
    //@ts-ignore
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updatedData = {
      ...req.body,
    };

    // Update fields in the user document
    Object.keys(updatedData).forEach((key) => {
      if (key in user && key in updatedData) {
        (user as any)[key] = updatedData[key as keyof typeof updatedData];
      }
    });
    await user.save();

    // Optionally, you can fetch the updated user document again, though it's not always necessary
    // const updatedUser = await User.findById(id);

    res.status(200).json({
      message: "User profile updated successfully",
      data: user, // Return the updated user document
    });
  }),
};

export default userController;

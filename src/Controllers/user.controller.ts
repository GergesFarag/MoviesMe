import User from "../Models/user.model";
import catchError from "../Utils/Errors/catchError";

const userController = {
  getProfile: catchError(async (req, res) => {
    //@ts-ignore
    const user = await User.findById(req.user.id).populate("stories");
    res.status(200).json({ message: "User profile", data: user });
  }),

  updateProfile: catchError(async (req, res) => {
    res.status(200).json({ message: "User profile updated" });
  }),
};

export default userController;

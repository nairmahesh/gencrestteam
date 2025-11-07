import { User } from "../models/user.model";

class UserService {
 async getUserById(userId: string) {
  const user = await User.findById(userId);
  return user;
 }
 async getAllUsers(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const users = await User.find({}).skip(skip).limit(limit);
  return users;
 }
 

}
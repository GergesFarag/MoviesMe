import { Schema } from "mongoose";

const LanguageSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  accents: {
    type: [
      new Schema({
        name: {
          type: String,
        },
      }),
    ],
  },
});

export default LanguageSchema;

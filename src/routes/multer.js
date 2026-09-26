const multer=require('multer')
const { v4: uuidv4 } = require('uuid');
const storage = multer.diskStorage({
    destination: function (req, file, path) {
      path(null, 'public/images')
    },
    filename: function (req, file, path) {
      
       var filename=uuidv4()+file.originalname.slice(file.originalname.lastIndexOf("."))
      path(null, filename)
    }
  })
  
  const upload = multer({ storage: storage })
  module.exports=upload
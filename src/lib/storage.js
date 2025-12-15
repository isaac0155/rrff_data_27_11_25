const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './src/public/img/profiles/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        var final = file.originalname
        if (final.length > 5){
            final = final.slice(-7)
        }
        cb(null, file.fieldname + '-' + uniqueSuffix + final)
        //console.log(file)
    }
})

const upload = multer({ storage })

module.exports = upload;
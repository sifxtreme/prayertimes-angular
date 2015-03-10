var gulp = require('gulp');
var gulpif = require('gulp-if');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');

gulp.task('js', function(){
  return gulp.src(["./angular.min.js", "./autocomplete.js", "./praytimes.js", "./app.js"])
    .pipe(concat('all.js'))
    .pipe(gulp.dest('./'))
    .pipe(uglify())
    .pipe(gulp.dest('./'))
});

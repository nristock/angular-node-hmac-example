module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    var buildPath = '_build';

    var staticDir = 'static';
    var nodeDir = 'server';

    grunt.initConfig({
        sass: {
            options: {
                outputStyle: 'compressed'
            },
            style: {
                src: [staticDir + '/css/*.scss'],
                dest: buildPath + '/' + staticDir + '/css/style.css'
            }
        },
        copy: {
            staticContent: {
                expand: true,
                src: [staticDir + '/**', '!**/*.scss'],
                dest: buildPath
            },
            node: {
                expand: true,
                cwd: nodeDir,
                src: ['**'],
                dest: buildPath
            }
        },
        clean: {
            all: {
                src: buildPath
            },
            staticContent: {
                src: [buildPath + '/' + staticDir]
            },
            node: {
                src: [buildPath + '/' + nodeDir]
            }
        },
        watch: {
            style: {
                files: [staticDir + '/css/*.scss'],
                tasks: ['sass']
            },
            copy: {
                files: [nodeDir + '/**', staticDir + '/**', '!**/*.scss'],
                tasks: ['copy']
            }
        }
    });


    grunt.registerTask('default', ['sass', 'copy'])

};

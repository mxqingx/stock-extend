pipeline {
    agent any

    environment {
        // 设置Node.js版本
        NODE_VERSION = '18'
        // 设置npm registry
        NPM_REGISTRY = 'https://registry.npmjs.org/'
    }

    stages {
        stage('代码检出') {
            steps {
                checkout scm
            }
        }

        stage('依赖安装') {
            steps {
                script {
                    // 使用Node.js 18
                    nodejs(nodeJSInstallationName: 'node-' + env.NODE_VERSION) {
                        // 安装依赖
                        sh 'pnpm install'
                    }
                }
            }
        }

        stage('代码质量检查') {
            steps {
                script {
                    nodejs(nodeJSInstallationName: 'node-' + env.NODE_VERSION) {
                        // 运行ESLint检查
                        sh 'pnpm run lint'
                    }
                }
            }
        }

        stage('构建应用') {
            steps {
                script {
                    nodejs(nodeJSInstallationName: 'node-' + env.NODE_VERSION) {
                        // 构建应用
                        sh 'pnpm run build'
                    }
                }
            }
        }

        stage('构建Android APK') {
            steps {
                script {
                    nodejs(nodeJSInstallationName: 'node-' + env.NODE_VERSION) {
                        // 构建Android调试APK
                        sh 'pnpm run android:apk:debug'
                    }
                }
            }
        }

        stage('部署') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                script {
                    // 这里可以添加部署步骤，例如：
                    // 部署到服务器、发布到应用市场等
                    echo '部署到生产环境'
                }
            }
        }
    }

    post {
        always {
            // 清理工作空间
            cleanWs()
        }
        success {
            echo '构建成功！'
        }
        failure {
            echo '构建失败，请检查日志！'
        }
    }
}
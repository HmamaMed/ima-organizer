# One Render service serves the API and the web routes used by account emails.
FROM node:24-alpine AS frontend
WORKDIR /web
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci
COPY mobile/ ./
# Same-origin API requests in the hosted web build. Android keeps its hosted API URL.
ENV VITE_API_URL=""
RUN npm run build

FROM eclipse-temurin:21-jdk-alpine AS backend
WORKDIR /app
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B
COPY backend/src/ src/
COPY --from=frontend /web/dist/ src/main/resources/static/
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=backend /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
